import type { CCCEventsListUpdate, CCCEventUpdate } from "../types"
import "./EventList.css"

type EventListProps = {
    eventList: CCCEventsListUpdate
    selectedEvent: CCCEventUpdate
    requestEvent: (gameNr?: string, eventNr?: string) => void
}

export function EventList({ eventList, selectedEvent, requestEvent }: EventListProps) {
    return (
        <select className="eventListContainer" value={selectedEvent.tournamentDetails.tNr} onChange={event => requestEvent(undefined, String(event.target.value))}>
            {eventList.events.map(event => (
                <option key={event.id} value={event.id}>
                    {event.name} ({event.tc.init}+{event.tc.incr})
                </option>
            ))}
        </select>
    )
}