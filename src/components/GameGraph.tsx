import { Line } from "react-chartjs-2";
import type { CCCEngine, CCCLiveInfo } from "../types";
import { useState } from "react";
import "./GameGraph.css"
import type { LiveInfoEntry } from "./LiveInfo";

type GameGraphProps = {
    liveInfosWhite: LiveInfoEntry[]
    liveInfosBlack: LiveInfoEntry[]
    liveInfosStockfish: LiveInfoEntry[]
    white: CCCEngine
    black: CCCEngine
}

const MODES = [
    {
        name: "Eval",
        map: function (liveInfo?: CCCLiveInfo) {
            if (!liveInfo)
                return NaN
            if (liveInfo.info.score.includes("+M"))
                return 10.0
            if (liveInfo.info.score.includes("-M"))
                return -10.0
            return Math.min(Math.max(Number(liveInfo.info.score), -10.0), 10.0)
        }
    },
    {
        name: "Depth",
        map: function (liveInfo?: CCCLiveInfo) {
            return Number(liveInfo?.info.depth)
        }
    },
    {
        name: "Nodes",
        map: function (liveInfo?: CCCLiveInfo) {
            return Number(liveInfo?.info.nodes)
        }
    },
    {
        name: "Time",
        map: function (liveInfo?: CCCLiveInfo) {
            return Number(liveInfo?.info.time) / 1000
        }
    },
    {
        name: "Speed",
        map: function (liveInfo?: CCCLiveInfo) {
            return Number(liveInfo?.info.speed)
        }
    },
    {
        name: "TB Hits",
        map: function (liveInfo?: CCCLiveInfo) {
            return Number(liveInfo?.info.tbhits)
        }
    },
    {
        name: "Hashfull",
        map: function (liveInfo?: CCCLiveInfo) {
            return Number(liveInfo?.info.hashfull)
        }
    }
]

export function GameGraph({
    liveInfosBlack, liveInfosWhite, white, black, liveInfosStockfish
}: GameGraphProps) {

    const [mode, setMode] = useState(0)

    const labels = Array.from({ length: Math.max(liveInfosWhite.length, liveInfosBlack.length, liveInfosStockfish.length) }, (_, i) => String(i + 1))

    const data = {
        labels,
        datasets: [
            {
                label: black.name,
                data: liveInfosBlack.map(MODES[mode].map),
                borderColor: 'rgba(0, 0, 0, 0.7)',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                spanGaps: true,
            },
            {
                label: white.name,
                data: liveInfosWhite.map(MODES[mode].map),
                borderColor: 'rgba(255, 255, 255, 0.7)',
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                spanGaps: true,
            },
            {
                label: "Stockfish",
                data: liveInfosStockfish.map(MODES[mode].map),
                borderColor: 'rgba(21, 101, 192, 0.7)',
                backgroundColor: 'rgba(21, 101, 192, 0.7)',
                spanGaps: true,
            },
        ],
    };

    return (
        <div className="gameGraph">
            <div className="modeSelectorList">
                {MODES.map((m, i) => (
                    <button key={m.name} onClick={() => setMode(i)} className={"modeSelector" + (mode === i ? " active" : "")}>{m.name}</button>
                ))}
            </div>
            <Line
                options={{
                    animation: false,
                    transitions: {
                        active: {
                            animation: { duration: 0 }
                        },
                    },
                    hover: { mode: undefined },
                    elements: {
                        line: { tension: 0 },
                        // point: { radius: 0 },
                    },
                    plugins: {
                        legend: { display: false, onClick: undefined },
                        tooltip: { enabled: false },
                    },
                    scales: {
                        y: { beginAtZero: true },
                    },
                }}
                data={data}
            />
        </div>
    )
}