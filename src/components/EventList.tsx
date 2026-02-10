import type { CCCEventsListUpdate, CCCEventUpdate } from "../types"

type EventListProps = {
    eventList: CCCEventsListUpdate
    selectedEvent: CCCEventUpdate
    requestEvent: (gameNr?: string, eventNr?: string) => void
}

export function EventList({ eventList, selectedEvent, requestEvent }: EventListProps) {
    return (
        <div className="eventListContainer">
            <table className="eventList">
                <tbody>
                    {eventList.events.map(event => (
                        <tr key={event.id} className={String(event.id) === selectedEvent.tournamentDetails.tNr ? "active" : ""} onClick={() => requestEvent(undefined, String(event.id))}>
                            <td>{event.name} ({event.tc.init}+{event.tc.incr})</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}