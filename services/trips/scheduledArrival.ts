import type { QueryableDb } from '@/services/db/queryableDb';
import { getStopCalls } from '@/services/gtfs/core/stopTimeWindow';
import { serviceDayStartMs } from '@/services/gtfs/departures/stopDepartures';

// The planned arrival can be off by a late vehicle, so the scheduled one is searched for this far either side.
const SEARCH_WINDOW_SEC = 2 * 3600;

/**
 * The timetable's arrival time at a ride's last stop, as a clock time. The ride's own planned arrival only says
 * roughly when, so it picks between today's and yesterday's service day: only the right one has the trip there.
 */
export async function scheduledArrivalMs(db: QueryableDb, tripPk: number, alightSequence: number, plannedMs: number, now: Date): Promise<number | null> {
    const [stop] = await db.getAllAsync<{ stop_pk: number }>(
        `SELECT ps.stop_pk FROM trips t
         JOIN pattern_stops ps ON ps.pattern_pk = t.pattern_pk AND ps.stop_sequence = ?
         WHERE t.trip_pk = ?`,
        [alightSequence, tripPk],
    );
    if (!stop) return null;

    for (const offset of [0, -1]) {
        const dayStartMs = serviceDayStartMs(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset));
        const aroundSec = Math.round((plannedMs - dayStartMs) / 1000);
        // Searched by departure; a stop's dwell is seconds.
        const calls = await getStopCalls(db, stop.stop_pk, aroundSec - SEARCH_WINDOW_SEC, aroundSec + SEARCH_WINDOW_SEC);
        const row = calls.find(c => c.tripPk === tripPk && c.stopSequence === alightSequence);
        if (row) return dayStartMs + (row.departureSec - row.dwellSec) * 1000;
    }
    return null;
}
