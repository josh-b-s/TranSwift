import type { QueryableDb } from '@/services/db/queryableDb';
import { chunks, marks } from './vehicleRoutes';

type LineRow = { trip_id: string; route_id: string; agency: number; terminus: string | null };

/**
 * Names the line each trip runs on by its route and the name of the stop it ends at, so a route's two directions
 * get different keys and its trips to the same end get the same one. Keyed by the feed's trip id. Trips the
 * timetable does not know are left out.
 */
export async function loadLineKeys(db: QueryableDb, tripIds: string[]): Promise<Map<string, string>> {
    const keys = new Map<string, string>();
    for (const ids of chunks(tripIds)) {
        const rows = await db.getAllAsync<LineRow>(
            `SELECT t.trip_id, p.route_id, p.agency, s.stop_name AS terminus
             FROM trips t
             JOIN patterns p ON p.pattern_pk = t.pattern_pk
             JOIN pattern_stops ps ON ps.pattern_pk = t.pattern_pk
              AND ps.stop_sequence = (SELECT MAX(stop_sequence) FROM pattern_stops WHERE pattern_pk = t.pattern_pk)
             JOIN stops s ON s.stop_pk = ps.stop_pk
             WHERE t.trip_id IN (${marks(ids.length)})`,
            ids,
        );
        for (const r of rows) if (!keys.has(r.trip_id)) keys.set(r.trip_id, `${r.agency}|${r.route_id}|${r.terminus ?? ''}`);
    }
    return keys;
}
