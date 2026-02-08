import type { CCCEngine, CCCLiveInfo } from "../types";

import "./EngineComponent.css"
import { EngineLogo } from "./EngineLogo";

type EngineComponentProps = {
    info: CCCLiveInfo
    engine: CCCEngine
    time: number
}

function formatLargeNumber(value: string) {
    const x = Number(value)
    if (x >= 1_000_000_000)
        return String(Math.floor(100 * x / 1_000_000_000) / 100).padEnd(2, "0") + "B"
    if (x >= 1_000_000)
        return String(Math.floor(100 * x / 1_000_000) / 100).padEnd(2, "0") + "M"
    if (x >= 1_000)
        return String(Math.floor(100 * x / 1_000) / 100).padEnd(2, "0") + "K"
    return String(value)
}

export function EngineComponent({ engine, info, time }: EngineComponentProps) {

    const hundreds = String(Math.floor(time / 10) % 100).padStart(2, "0");
    const seconds = String(Math.floor(time / 1000) % 60).padStart(2, "0");
    const minutes = String(Math.floor(time / (1000 * 60)) % 60).padStart(2, "0");
    const timeString = `${minutes}:${seconds}.${hundreds}`

    return (
        <div className="engine">
            <EngineLogo engine={engine}/>
            <span className="engineName">{engine.name}</span>
            <span className="engineEval">{info.info.score}</span>
            <span className="engineField"> D: <span>{info.info.depth} / {info.info.seldepth}</span></span>
            <span className="engineField"> N: <span>{formatLargeNumber(info.info.nodes)}</span></span>
            <span className="engineField"> NPS: <span>{formatLargeNumber(info.info.speed)}</span></span>
            <span className="engineField"> T: <span>{timeString}</span></span>
        </div>
    )
}