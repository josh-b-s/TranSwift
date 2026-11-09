import type { QueryableDb } from '@/services/db/queryableDb';
import { getStopCalls } from '@/services/gtfs/core/stopTimeWindow';
import type { Departure } from './stopDepartures';

/** A trip that has not reached its last stop twelve hours after this one is not a trip we can show. */
const MAX_REMAINING_SEC = 12 * 3600;

export type TripStop = { stopName: string; stopSequence: number; timeMs: number };

type PatternStopRow = { stop_pk: number; stop_name: string; stop_sequence: number };

/**
 * The stops a departure calls at from its own stop onward, in order. The first time is the departure; later ones
 * are arrivals. Calls are stored by stop, so each stop of the pattern is asked for the trip's call in a time window.
 */
export async function getTripStops(db: QueryableDb, departure: Departure): Promise<TripStop[]> {
    const fromSec = Math.round((departure.timeMs - departure.dayStartMs) / 1000);
    const stops = await db.getAllAsync<PatternStopRow>(
        `SELECT ps.stop_pk, s.stop_name, ps.stop_sequence
         FROM trips t
         JOIN pattern_stops ps ON ps.pattern_pk = t.pattern_pk AND ps.stop_sequence >= ?
         JOIN stops s ON s.stop_pk = ps.stop_pk
         WHERE t.trip_pk = ?
         ORDER BY ps.stop_sequence`,
        [departure.stopSequence, departure.tripPk],
    );
    const found = await Promise.all(stops.map(async (stop, i) => {
        const calls = await getStopCalls(db, stop.stop_pk, fromSec, fromSec + MAX_REMAINING_SEC);
        const call = calls.find(c => c.tripPk === departure.tripPk && c.stopSequence === stop.stop_sequence);
        if (!call) return null;
        const sec = i === 0 ? call.departureSec : call.departureSec - call.dwellSec;
        return { stopName: stop.stop_name, stopSequence: stop.stop_sequence, timeMs: departure.dayStartMs + sec * 1000 };
    }));
    return found.filter(s => s !== null);
}
