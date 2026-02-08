import type { DrawShape } from "@lichess-org/chessground/draw"
import type { CCCLiveInfo } from "../types"
import type { Square } from "chess.js"

export class StockfishWorker {

    worker: Worker
    onMessage: ((liveInfo: CCCLiveInfo, arrow: DrawShape | null) => void) | null = null
    currentFen: string | null = null
    receivedBestMove: boolean = true

    constructor() {
        this.worker = new Worker("/stockfish-17.1-single-a496a04.js")

        this.worker.onmessage = (e) => {
            if (e.data.includes("bestmove"))
                this.receivedBestMove = true

            if (!e.data.startsWith("info depth")) return;
            if (e.data.includes("currmove")) return;
            if (!this.currentFen || !this.onMessage || this.currentFen === "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1") return;
            
            const data = e.data.split(" ")
            const color = this.currentFen.includes(" w ") ? "white" : "black"
            const ply = 2 * Number(this.currentFen.split(" ").at(-1)) - (color === "white" ? 1 : 0)

            const liveInfo: CCCLiveInfo = {
                type: "liveInfo",
                info: {
                    ply,
                    color,
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
            const arrow: DrawShape | null = bestmove && bestmove.length >= 4 ? { orig: bestmove.slice(0, 2) as Square, dest: bestmove.slice(2, 4) as Square, brush: "stockfish" } : null
            this.onMessage(liveInfo, arrow)
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