import type { CCCEngine, CCCEventUpdate, CCCGame } from "../types";
import "./Crosstable.css"

type CrosstableProps = {
    engines: CCCEngine[]
    cccEvent: CCCEventUpdate
    onClose: () => void
}

export function Crosstable({ engines, cccEvent, onClose }: CrosstableProps) {
    const allGames = [
        ...cccEvent.tournamentDetails.schedule.past,
        ...(cccEvent.tournamentDetails.schedule.present ? [cccEvent.tournamentDetails.schedule.present] : []),
        ...cccEvent.tournamentDetails.schedule.future
    ]

    return (
        <table className="crosstable">
            <tbody>
                <tr>
                    <td>
                        <button onClick={onClose}>Close</button>
                    </td>
                    {engines.map((engine, i) => (
                        <td key={engine.id}>#{i + 1}. {engine.name}</td>
                    ))}
                </tr>
                {engines.map((engine, i) => (
                    <tr key={engine.id}>
                        <td>#{i + 1}. {engine.name}</td>
                        {engines.map(engine2 => {
                            const games = allGames.filter(game => game.blackId === engine.id && game.whiteId === engine2.id || game.whiteId === engine.id && game.blackId === engine2.id)
                            const gamePairs: [CCCGame, CCCGame][] = [];
                            for (let i = 0; i < allGames.length; i += 2) {
                                gamePairs.push(games.slice(i, i + 2) as [CCCGame, CCCGame]);
                            }
                            return (
                                <td key={engine2.id}>
                                    <div className="h2h">
                                        {gamePairs.filter(gamePair => gamePair.length > 1).map(gamePair => {
                                            const whiteWin1 = engine.id === gamePair[0].whiteId ? "win" : "loss"
                                            const blackWin1 = engine.id === gamePair[0].blackId ? "win" : "loss"
                                            const result1 = !gamePair[0].outcome ? "tbd" : gamePair[0].outcome === "1-0" ? whiteWin1 : gamePair[0].outcome === "0-1" ? blackWin1 : "draw"

                                            const whiteWin2 = engine.id === gamePair[1].whiteId ? "win" : "loss"
                                            const blackWin2 = engine.id === gamePair[1].blackId ? "win" : "loss"
                                            const result2 = !gamePair[0].outcome ? "tbd" : gamePair[1].outcome === "1-0" ? whiteWin2 : gamePair[1].outcome === "0-1" ? blackWin2 : "draw"

                                            const text1 = result1 === "tbd" ? "-" : result1 === "win" ? "1" : result1 === "loss" ? "0" : "½"
                                            const text2 = result2 === "tbd" ? "-" : result2 === "win" ? "1" : result2 === "loss" ? "0" : "½"

                                            const pairResult =
                                                result1 === "win" && result2 !== "loss" || result2 === "win" && result1 !== "loss" ? "win" :
                                                    result1 === "loss" && result2 !== "win" || result2 === "loss" && result1 !== "win" ? "loss" :
                                                        "";
                                            return (
                                                <span key={gamePair[0].gameNr} className={"gamePair " + pairResult}>
                                                    <span className={result1}>{text1}</span>
                                                    <span className={result2}>{text2}</span>
                                                </span>
                                            )
                                        })}
                                    </div>
                                </td>
                            )
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    )
}