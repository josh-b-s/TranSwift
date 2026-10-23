import { getDb } from '@/services/db/sqliteDb';
import type { Coverage } from '../catalog/coverage';

export type FeedStats = {
    /** Last service date in the feed, GTFS YYYYMMDD. Null if the feed has no calendar rows. */
    serviceEnd: string | null;
    /** Box around every stop. Null if the feed has no stops. */
    coverage: Coverage | null;
};

// stops.stop_lat/stop_lon are degrees * 1_000_000 (see schema.sql).
const COORD_SCALE = 1_000_000;

/** Reads stats from the active database. */
export async function computeFeedStats(): Promise<FeedStats> {
    const db = await getDb();

    const [{ last_end }] = await db.getAllAsync<{ last_end: string | null }>('SELECT MAX(end_date) AS last_end FROM calendar');
    const [{ last_added }] = await db.getAllAsync<{ last_added: string | null }>(
        'SELECT MAX(date) AS last_added FROM calendar_dates WHERE exception_type = 1',
    );
    // YYYYMMDD strings sort the same as the dates they name.
    const serviceEnd = [last_end, last_added].filter((d): d is string => !!d).sort().pop() ?? null;

    const [box] = await db.getAllAsync<{ a: number | null; b: number | null; c: number | null; d: number | null }>(
        'SELECT MIN(stop_lat) AS a, MAX(stop_lat) AS b, MIN(stop_lon) AS c, MAX(stop_lon) AS d FROM stops',
    );
    const coverage = box.a === null || box.b === null || box.c === null || box.d === null
        ? null
        : {
            minLat: box.a / COORD_SCALE,
            maxLat: box.b / COORD_SCALE,
            minLon: box.c / COORD_SCALE,
            maxLon: box.d / COORD_SCALE,
        };

    return { serviceEnd, coverage };
}
