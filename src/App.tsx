import { Chessground } from '@lichess-org/chessground'
import { Chess, Move, type Square } from 'chess.js'
import { useEffect, useRef, useState } from 'react'
import { CCCWebSocket } from './websocket'
import type { Api } from '@lichess-org/chessground/api'
import type { CCCMessage, CCCEventUpdate, CCCEventsListUpdate, CCCClocks, CCCGameUpdate } from './types'
import type { DrawShape } from '@lichess-org/chessground/draw'
import { CategoryScale, Chart, Legend, LinearScale, LineElement, PointElement, Title, Tooltip } from 'chart.js'
import { EngineComponent } from './components/EngineComponent'
import { StandingsTable } from './components/StandingsTable'
import { GameGraph } from './components/GameGraph'
import type { Config } from '@lichess-org/chessground/config'
import { ScheduleComponent } from './components/ScheduleComponent'
import { StockfishWorker } from './components/StockfishWorker'
import './App.css'
import { emptyLiveInfo, extractLiveInfoFromGame, type LiveInfoEntry } from './components/LiveInfo'
import { Crosstable } from './components/Crosstable'
import { EventList } from './components/EventList'

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

    const stockfish = useRef<StockfishWorker>(null)
    const [fen, setFen] = useState(game.current.fen())

    const [popupOpen, setPopupOpen] = useState(false)
    const [cccEventList, setCccEventList] = useState<CCCEventsListUpdate>()
    const [cccEvent, setCccEvent] = useState<CCCEventUpdate>()
    const [cccGame, setCccGame] = useState<CCCGameUpdate>()
    const [clocks, setClocks] = useState<CCCClocks>({ binc: "0", winc: "0", btime: "0", wtime: "0", type: "clocks" })

    const [liveInfosWhite, setLiveInfosWhite] = useState<LiveInfoEntry[]>([])
    const [liveInfosBlack, setLiveInfosBlack] = useState<LiveInfoEntry[]>([])
    const [liveInfosStockfish, setLiveInfosStockfish] = useState<LiveInfoEntry[]>([])

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

                setCccGame(msg)

                game.current.loadPgn(msg.gameDetails.pgn)
                lastMove = game.current.history({ verbose: true }).at(-1)!!
                updateBoard([lastMove.from, lastMove.to])

                const { liveInfosBlack, liveInfosWhite } = extractLiveInfoFromGame(game.current)
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
        if (eventNr) message["eventNr"] = eventNr

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

        stockfish.current = new StockfishWorker()

        return () => {
            clearInterval(clockTimer)
            stockfish.current?.terminate()
        }
    }, [])

    useEffect(() => {
        if (!stockfish.current) return

        stockfish.current.onMessage = (result) => {
            if (game.current.getHeaders()["Event"] === "?") return
            if (game.current.fen() != result.fen) return

            stockfishArrow.current = result.arrow
            updateBoard(["a1", "a1"], true)

            setLiveInfosStockfish(data => {
                const newData = [...data]
                newData[result.liveInfo.info.ply] = result.liveInfo
                return newData
            })
        }
        stockfish.current.analyze(fen)
    }, [fen])

    const latestLiveInfoBlack = liveInfosBlack.at(-1) ?? emptyLiveInfo()
    const latestLiveInfoWhite = liveInfosWhite.at(-1) ?? emptyLiveInfo()

    const engines = (cccEvent?.tournamentDetails.engines ?? []).sort((a, b) => Number(b.points) - Number(a.points)) ?? []
    const white = engines.find(engine => engine.name === game.current.getHeaders()["White"])
    const black = engines.find(engine => engine.name === game.current.getHeaders()["Black"])

    return (
        <div className="app">

            {popupOpen && <div className="popup">
                <button onClick={() => setPopupOpen(false)}>Close</button>
                {cccEvent && <Crosstable engines={engines} cccEvent={cccEvent} />}
            </div>}

            <div className="boardWindow">
                {black && clocks && <EngineComponent info={latestLiveInfoBlack} engine={black} time={Number(clocks.btime)} />}

                <div ref={boardElementRef} className="board"></div>

                {white && clocks && <EngineComponent info={latestLiveInfoWhite} engine={white} time={Number(clocks.wtime)} />}
            </div>

            {white && black && <div className="standingsWindow">
                <h2>Standings</h2>
                <button className="showCrosstable" onClick={() => setPopupOpen(true)}>Show Crosstable</button>
                <StandingsTable engines={engines} />
                <GameGraph black={black} white={white} liveInfosBlack={liveInfosBlack} liveInfosWhite={liveInfosWhite} liveInfosStockfish={liveInfosStockfish} />
            </div>}

            {cccEvent && cccGame && cccEventList && <div className="scheduleWindow">
                <h2>Schedule</h2>
                <ScheduleComponent event={cccEvent} engines={engines} requestEvent={requestEvent} selectedGame={cccGame} />

                <h2>Event History</h2>
                <EventList eventList={cccEventList} requestEvent={requestEvent} selectedEvent={cccEvent}/>
            </div>}

        </div>
    )
}

export default App
