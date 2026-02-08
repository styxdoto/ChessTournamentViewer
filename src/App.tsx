import { Chessground } from '@lichess-org/chessground'
import { Chess, Move, type Square } from 'chess.js'
import { useEffect, useRef, useState } from 'react'
import { CCCWebSocket } from './websocket'
import type { Api } from '@lichess-org/chessground/api'
import type { CCCLiveInfo, CCCMessage, CCCEventUpdate, CCCEventsListUpdate, CCCClocks } from './types'
import type { DrawShape } from '@lichess-org/chessground/draw'
import { CategoryScale, Chart, Legend, LinearScale, LineElement, PointElement, Title, Tooltip } from 'chart.js'
import { EngineComponent } from './components/EngineComponent'
import { StandingsTable } from './components/StandingsTable'
import { GameGraph } from './components/GameGraph'
import type { Config } from '@lichess-org/chessground/config'
import { ScheduleComponent } from './components/ScheduleComponent'
import './App.css'

class StockfishEngine {

    worker: Worker
    onMessage: ((message: string) => void) | null = null
    currentFen: string | null = null
    receivedBestMove: boolean = true

    constructor() {
        this.worker = new Worker("/stockfish-17.1-single-a496a04.js")
        this.worker.onmessage = (e) => {
            if (e.data.includes("bestmove"))
                this.receivedBestMove = true
            this.onMessage?.(e.data)
        }
        this.sendMessage("uci")
    }

    sendMessage(command: string) {
        this.worker.postMessage(command)
    }

    async analyze(fen: string) {
        if (this.currentFen === fen) return
        this.currentFen = fen

        this.sendMessage("stop")
        const waitForReady = () => {
            return new Promise<void>((resolve) => {
                const check = () => {
                    if (this.receivedBestMove) resolve()
                    else setTimeout(check, 10)
                };
                check()
            });
        };
        await waitForReady()

        this.receivedBestMove = false
        this.sendMessage(`position fen ${fen}`)
        this.sendMessage("go infinite")
    }

    terminate() {
        this.sendMessage("quit")
        this.worker.terminate()
    }
}

const CLOCK_UPDATE_MS = 25

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

function App() {

    const boardElementRef = useRef<HTMLDivElement>(null)
    const boardRef = useRef<Api>(null)
    const whiteArrow = useRef<[DrawShape, DrawShape]>(null)
    const blackArrow = useRef<[DrawShape, DrawShape]>(null)
    const stockfishArrow = useRef<DrawShape>(null)
    const game = useRef(new Chess())
    const ws = useRef(new CCCWebSocket("wss://ccc-api.gcp-prod.chess.com/ws"))

    const stockfish = useRef<StockfishEngine>(null)
    const [fen, setFen] = useState(game.current.fen())

    const [_, setCccEventList] = useState<CCCEventsListUpdate>()
    const [cccEvent, setCccEvent] = useState<CCCEventUpdate>()
    const [clocks, setClocks] = useState<CCCClocks>({ binc: "0", winc: "0", btime: "0", wtime: "0", type: "clocks" })

    const [liveInfosWhite, setLiveInfosWhite] = useState<(CCCLiveInfo | undefined)[]>([])
    const [liveInfosBlack, setLiveInfosBlack] = useState<(CCCLiveInfo | undefined)[]>([])
    const [liveInfosStockfish, setLiveInfosStockfish] = useState<(CCCLiveInfo | undefined)[]>([])

    function updateBoard(lastMove: [Square, Square], arrowsOnly: boolean = false) {
        const arrows: DrawShape[] = []
        if (whiteArrow.current)
            arrows.push(whiteArrow.current[0])
        if (blackArrow.current)
            arrows.push(blackArrow.current[0])
        if (stockfishArrow.current)
            arrows.push(stockfishArrow.current)

        let config: Config = {
            drawable: {
                // @ts-ignore
                brushes: {
                    white: {
                        key: "white",
                        color: "#fff",
                        opacity: 0.7,
                        lineWidth: 10,
                    },
                    black: {
                        key: "black",
                        color: "#000",
                        opacity: 0.7,
                        lineWidth: 10,
                    },
                    stockfish: {
                        key: "stockfish",
                        color: "#0D47A1",
                        opacity: 0.7,
                        lineWidth: 10,
                    }
                },
                enabled: false,
                eraseOnMovablePieceClick: false,
                shapes: arrows,
            }
        }

        if (!arrowsOnly) {
            config.fen = game.current.fen()
            config.lastMove = lastMove
        }

        setFen(game.current.fen())
        boardRef.current?.set(config)
    }

    function updateClocks() {
        setClocks(currentClock => {
            if (!currentClock) return currentClock
            if (game.current.getHeaders()["Termination"]) return currentClock

            let wtime = Number(currentClock.wtime)
            let btime = Number(currentClock.btime)

            if (game.current.turn() == "w")
                wtime -= CLOCK_UPDATE_MS
            else
                btime -= CLOCK_UPDATE_MS

            return {
                ...currentClock,
                wtime: String(wtime),
                btime: String(btime),
            }
        })
    }

    function handleMessage(msg: CCCMessage) {
        let lastMove: Move

        switch (msg.type) {

            case "eventUpdate":
                setCccEvent(msg)
                break

            case "gameUpdate":
                whiteArrow.current = null
                blackArrow.current = null
                stockfishArrow.current = null

                game.current.loadPgn(msg.gameDetails.pgn)
                lastMove = game.current.history({ verbose: true }).at(-1)!!
                updateBoard([lastMove.from, lastMove.to])

                const liveInfosWhite: (CCCLiveInfo | undefined)[] = []
                const liveInfosBlack: (CCCLiveInfo | undefined)[] = []
                game.current.getComments().forEach((value, i) => {
                    const data = value.comment.split(", ")

                    if (data[0] === "book") return

                    let score = data[0].split("/")[0]
                    if (i % 2 === 1) {
                        if (score.includes("+"))
                            score = score.replace("+", "-")
                        else
                            score = score.replace("-", "+")
                    }

                    const liveInfo: CCCLiveInfo = {
                        type: "liveInfo",
                        info: {
                            color: i % 2 === 0 ? "w" : "b",
                            depth: data[0].split("/")[1].split(" ")[0],
                            multipv: "1",
                            hashfull: data[6].split("=")[1],
                            name: "",
                            nodes: data[3].split("=")[1],
                            ply: i + 1,
                            pv: "",
                            score,
                            seldepth: data[4].split("=")[1],
                            speed: data[5].split("=")[1],
                            tbhits: data[7].split("=")[1],
                            time: data[0].split(" ")[1].split("s")[0].replace(".", ""),
                        }
                    }
                    if (i % 2 === 0)
                        liveInfosWhite[liveInfo.info.ply] = liveInfo
                    else
                        liveInfosBlack[liveInfo.info.ply] = liveInfo
                })

                setLiveInfosWhite(liveInfosWhite)
                setLiveInfosBlack(liveInfosBlack)
                setLiveInfosStockfish([])

                break;

            case "liveInfo":
                const pv = msg.info.pv.split(" ")
                const nextMove = pv[0]
                const secondNextMove = pv.length > 1 ? pv[1] : pv[0]
                const arrow: [DrawShape, DrawShape] | null = nextMove.length >= 4 && secondNextMove.length >= 4 ? [
                    { orig: nextMove.slice(0, 2) as Square || "a1", dest: nextMove.slice(2, 4) as Square || "a1", brush: msg.info.color },
                    { orig: secondNextMove.slice(0, 2) as Square || "a1", dest: secondNextMove.slice(2, 4) as Square || "a1", brush: msg.info.color },
                ] : null

                if (msg.info.color == "white") {
                    setLiveInfosWhite(data => {
                        const newData = [...data]
                        newData[msg.info.ply] = msg
                        return newData
                    })
                    whiteArrow.current = arrow
                }
                else {
                    setLiveInfosBlack(data => {
                        const newData = [...data]
                        newData[msg.info.ply] = msg
                        return newData
                    })
                    blackArrow.current = arrow
                }

                lastMove = game.current.history({ verbose: true }).at(-1)!!
                updateBoard([lastMove.from, lastMove.to], true)

                break;

            case "eventsListUpdate":
                setCccEventList(msg)
                break;

            case "clocks":
                setClocks(msg)
                break;

            case "newMove":
                const from = msg.move.slice(0, 2) as Square
                const to = msg.move.slice(2, 4) as Square
                const promo = msg.move?.[4]

                if (game.current.turn() == "w" && whiteArrow.current) {
                    whiteArrow.current = [whiteArrow.current[1], whiteArrow.current[0]]
                } else if (blackArrow.current) {
                    blackArrow.current = [blackArrow.current[1], blackArrow.current[0]]
                }

                game.current.move({ from, to, promotion: promo as any })
                updateBoard([from, to])

                break
        }
    }

    function requestEvent(gameNr?: string, eventNr?: string) {
        let message: any = { type: "requestEvent" }
        if (gameNr) message["gameNr"] = gameNr
        if (eventNr) message["enr"] = eventNr

        ws.current.send(message)
    }

    useEffect(() => {
        if (boardRef.current || !boardElementRef.current) return;

        boardRef.current = Chessground(boardElementRef.current, {
            fen: game.current.fen(),
            orientation: 'white',
            movable: { free: false, color: undefined, dests: undefined },
            selectable: { enabled: false },
        })

        ws.current.connect(handleMessage)
        return () => ws.current.disconnect()
    }, [boardElementRef.current])

    useEffect(() => {
        const clockTimer = setInterval(updateClocks, CLOCK_UPDATE_MS)

        stockfish.current = new StockfishEngine()

        return () => {
            clearInterval(clockTimer)
            stockfish.current?.terminate()
        }
    }, [])

    useEffect(() => {
        if (!stockfish.current) return

        stockfish.current.onMessage = (message) => {
            if (!message.startsWith("info depth")) return;
            if (message.includes("currmove")) return;
            if (game.current.getHeaders()["Event"] === "?") return;
            
            const data = message.split(" ")

            const liveInfo: CCCLiveInfo = {
                type: "liveInfo",
                info: {
                    ply: 2 * game.current.moveNumber() - (game.current.turn() === "w" ? 1 : 0),
                    color: game.current.turn() === "w" ? "white" : "black",
                    depth: data[2],
                    hashfull: data[15],
                    multipv: data[6],
                    name: "",
                    nodes: data[11],
                    pv: "",
                    score: String(Number(data[9]) / 100),
                    seldepth: data[4],
                    speed: data[13],
                    tbhits: "",
                    time: "",
                }
            }

            const bestmove = data[19]
            stockfishArrow.current = bestmove && bestmove.length >= 4 ? { orig: bestmove.slice(0, 2) as Square, dest: bestmove.slice(2, 4) as Square, brush: "stockfish" } : null
            updateBoard(["a1", "a1"], true)

            setLiveInfosStockfish(data => {
                const newData = [...data]
                newData[liveInfo.info.ply] = liveInfo
                return newData
            })
        }
        stockfish.current.analyze(fen)
    }, [fen])

    const latestLiveInfoBlack = liveInfosBlack.at(-1) ?? { type: "liveInfo", info: { color: "b", depth: "0", hashfull: "0", multipv: "1", name: "", nodes: "0", ply: 0, pv: "", score: "0", seldepth: "0", speed: "0", tbhits: "0", time: "0" } }
    const latestLiveInfoWhite = liveInfosWhite.at(-1) ?? { type: "liveInfo", info: { color: "w", depth: "0", hashfull: "0", multipv: "1", name: "", nodes: "0", ply: 0, pv: "", score: "0", seldepth: "0", speed: "0", tbhits: "0", time: "0" } }

    const engines = cccEvent?.tournamentDetails.engines ?? []
    const white = engines.find(engine => engine.name === game.current.getHeaders()["White"])
    const black = engines.find(engine => engine.name === game.current.getHeaders()["Black"])

    return (
        <div className="app">

            <div className="boardWindow">
                {black && clocks && <EngineComponent info={latestLiveInfoBlack} engine={black} time={Number(clocks.btime)} />}

                <div ref={boardElementRef} className="board"></div>

                {white && clocks && <EngineComponent info={latestLiveInfoWhite} engine={white} time={Number(clocks.wtime)} />}
            </div>

            {white && black && <div className="standingsWindow">
                <h2>Standings</h2>
                <StandingsTable engines={engines} />
                <GameGraph black={black} white={white} liveInfosBlack={liveInfosBlack} liveInfosWhite={liveInfosWhite} liveInfosStockfish={liveInfosStockfish} />
            </div>}

            {cccEvent && <div className="scheduleWindow">
                <h2>Schedule</h2>
                <ScheduleComponent event={cccEvent} engines={engines} requestEvent={requestEvent} />
            </div>}

        </div>
    )
}

export default App
