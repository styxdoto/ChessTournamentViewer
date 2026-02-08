import type { CCCEngine } from "../types"

type EngineLogoProps = {
    engine: CCCEngine
}

export function EngineLogo({engine}: EngineLogoProps) {
    return (
        <img src={"https://images.chesscomfiles.com/chess-themes/computer_chess_championship/avatars/" + engine.imageUrl + ".png"} />
    )
}