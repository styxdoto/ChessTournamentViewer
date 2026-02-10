import type { Chess } from "chess.js"
import { Fragment, useEffect, useRef } from "react"
import "./MoveList.css"

type MoveListProps = {
    game: Chess
}

export function MoveList({ game }: MoveListProps) {

    const moves = game.history()
    const moveListRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!moveListRef.current) return

        moveListRef.current.scrollTop = moveListRef.current.scrollHeight
    }, [moveListRef.current, moves.length])

    return (
        <div className="moveList" ref={moveListRef}>
            {moves.map((move, i) => (
                <Fragment key={i}>
                    {i % 2 == 0 ? <span className="moveNumber">{i / 2 + 1}. </span> : null}
                    <span className="move">{move}</span>
                </Fragment>
            ))}
        </div>
    )
}