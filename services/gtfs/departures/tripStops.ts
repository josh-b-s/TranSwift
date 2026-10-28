import type { QueryableDb } from '@/services/db/queryableDb';
import type { Departure } from './stopDepartures';

/** A trip that has not reached its last stop twelve hours after this one is not a trip we can show. */
const MAX_REMAINING_SEC = 12 * 3600;

export type TripStop = { stopName: string; stopSequence: number; timeMs: number };

type TripStopRow = { stop_name: string; stop_sequence: number; arrival_sec: number; departure_sec: number };

/**
 * The stops a departure calls at from its own stop onward, in order. The first time is the departure; later ones
 * are arrivals. stop_times has no index on trip_pk, so the rows are found by stop and a time window, with
 * the pattern giving the order, rather than by a scan of the whole trip.
 */
export async function getTripStops(db: QueryableDb, departure: Departure): Promise<TripStop[]> {
    const fromSec = Math.round((departure.timeMs - departure.dayStartMs) / 1000);
    const rows = await db.getAllAsync<TripStopRow>(
        `SELECT s.stop_name, ps.stop_sequence, st.arrival_sec, st.departure_sec
         FROM trips t
         JOIN pattern_stops ps ON ps.pattern_pk = t.pattern_pk AND ps.stop_sequence >= ?
         JOIN stop_times st ON st.stop_pk = ps.stop_pk
          AND st.departure_sec BETWEEN ? AND ?
          AND st.trip_pk = t.trip_pk
          AND st.stop_sequence = ps.stop_sequence
         JOIN stops s ON s.stop_pk = ps.stop_pk
         WHERE t.trip_pk = ?
         ORDER BY ps.stop_sequence`,
        [departure.stopSequence, fromSec, fromSec + MAX_REMAINING_SEC, departure.tripPk],
    );
    return rows.map((r, i) => ({
        stopName: r.stop_name,
        stopSequence: r.stop_sequence,
        timeMs: departure.dayStartMs + (i === 0 ? r.departure_sec : r.arrival_sec) * 1000,
    }));
}
