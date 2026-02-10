import type { DrawShape } from "@lichess-org/chessground/draw"
import type { CCCEngine, CCCLiveInfo } from "../types"
import type { Square } from "chess.js"

export type AnalysisResult = {
    fen: string;
    liveInfo: CCCLiveInfo;
    arrow: DrawShape | null;
}

const StockfishEngineDefinition: CCCEngine = {
    authors: "",
    config: { command: "", options: {}, timemargin: 0 },
    country: "",
    elo: "",
    facts: "",
    flag: "",
    id: "",
    imageUrl: "stockfish",
    name: "Stockfish 17.1",
    perf: "",
    points: "",
    rating: "",
    updatedAt: "",
    version: "",
    website: "",
    year: "",
}

export { StockfishEngineDefinition }

export class StockfishWorker {
    private worker: Worker;

    public onMessage: ((result: AnalysisResult) => void) | null = null;

    private isSearching: boolean = false;
    private activeFen: string | null = null;
    private latestRequestedFen: string | null = null;

    private queue: Promise<void> = Promise.resolve();

    private stopSignal: (() => void) | null = null;

    constructor() {
        this.worker = new Worker("/stockfish-17.1-single-a496a04.js");

        this.worker.onmessage = (e) => this.handleWorkerMessage(e);

        this.post("uci");
        this.post("setoption name Hash value 128");
        this.post("isready");
        this.post("ucinewgame");
    }

    public analyze(fen: string) {
        this.latestRequestedFen = fen;

        this.queue = this.queue.then(async () => {
            if (this.latestRequestedFen !== fen) {
                return;
            }
            await this.performAnalysis(fen);
        }).catch(err => {
            console.error("Worker Queue Error:", err);
            this.isSearching = false;
        });
    }

    private async performAnalysis(fen: string) {
        if (this.isSearching) {
            this.post("stop");
            await this.waitForStop();
        }

        this.activeFen = fen;
        this.post(`position fen ${fen}`);
        this.post("go infinite");
        this.isSearching = true;
    }

    private handleWorkerMessage(e: MessageEvent) {
        const msg = e.data;

        if (msg.startsWith("bestmove")) {
            this.isSearching = false;
            if (this.stopSignal) {
                this.stopSignal();
                this.stopSignal = null;
            }
            return;
        }

        if (msg.startsWith("info depth") && !msg.includes("currmove") && this.onMessage && this.activeFen) {
            const parsed = this.parseInfo(msg, this.activeFen);
            if (parsed) {
                this.onMessage({
                    fen: this.activeFen,
                    liveInfo: parsed.liveInfo,
                    arrow: parsed.arrow
                });
            }
        }
    }

    private waitForStop(): Promise<void> {
        return new Promise((resolve) => {
            this.stopSignal = resolve;
        });
    }

    private post(command: string) {
        this.worker.postMessage(command);
    }

    private parseInfo(raw: string, fen: string) {
        const data = raw.split(" ");
        const color = fen.includes(" w ") ? "white" : "black";
        const fenParts = fen.split(" ");
        const fullmoves = Number(fenParts[fenParts.length - 1]) || 1;
        const ply = 2 * fullmoves - (color === "white" ? 1 : 0) - 1;

        const time = Number(data[17]);
        if (isNaN(time)) return null;

        let score = "+0.00";
        const scoreIdx = data.indexOf("score");
        if (scoreIdx !== -1) {
            let scoreNumber = 0
            if (data[scoreIdx + 1] === "cp") {
                scoreNumber = Number(data[scoreIdx + 2]) / 100 * (color === "black" ? -1 : 1);
            } else {
                scoreNumber = Math.min(Math.max(Number(data[scoreIdx + 2]) * 10, -10, 10))
            }
            score = (scoreNumber >= 0 ? "+" : "-") + scoreNumber
            if (!score.includes("."))
                score += "."
            while (score.split(".")[1].length < 2)
                score += "0"
        }

        const bestmove = data[19];
        const arrow: DrawShape | null = bestmove && bestmove.length >= 4
            ? { orig: bestmove.slice(0, 2) as Square, dest: bestmove.slice(2, 4) as Square, brush: "stockfish" }
            : null;

        const liveInfo: CCCLiveInfo = {
            type: "liveInfo",
            info: {
                ply,
                color,
                score,
                depth: data[data.indexOf("depth") + 1],
                name: "",
                hashfull: data[data.indexOf("hashfull") + 1],
                multipv: data[data.indexOf("multipv") + 1],
                nodes: data[data.indexOf("nodes") + 1],
                pv: data.slice(data.indexOf("pv") + 1).join(" "),
                seldepth: data[data.indexOf("seldepth") + 1],
                speed: data[data.indexOf("nps") + 1],
                tbhits: "0",
                time: data[data.indexOf("time") + 1],
            }
        };

        return { liveInfo, arrow };
    }

    public terminate() {
        this.post("quit");
        this.worker.terminate();
    }
}