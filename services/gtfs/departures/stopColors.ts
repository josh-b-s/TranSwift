import type { QueryableDb } from '@/services/db/queryableDb';
import { fallbackRouteColor, hexColor } from '@/services/gtfs/core/routeTypeUtil';

type Row = {
    stop_pk: number;
    route_short_name: string | null;
    route_long_name: string | null;
    route_type: number;
    route_color: string | null;
    patterns: number;
};

// null: a stop no route serves. Kept so it is not asked about again.
const cache = new Map<number, string | null>();

/** Call when the database changes. */
export function invalidateStopColors(): void {
    cache.clear();
}

/** The colours already loaded for these stops. Stops not loaded yet, or served by no route, are left out. */
export function cachedStopColors(stopPks: number[]): Map<number, string> {
    const colors = new Map<number, string>();
    for (const pk of stopPks) {
        const color = cache.get(pk);
        if (color) colors.set(pk, color);
    }
    return colors;
}

/**
 * Loads the colour of the route serving each stop most, judged by how many of its patterns call there, into the
 * cache that cachedStopColors reads. Only stops not seen before touch the database.
 */
export async function loadStopColors(db: QueryableDb, stopPks: number[]): Promise<void> {
    const missing = stopPks.filter(pk => !cache.has(pk));
    if (missing.length === 0) return;

    const rows = await db.getAllAsync<Row>(
        `SELECT ps.stop_pk, r.route_short_name, r.route_long_name, r.route_type, r.route_color, COUNT(*) AS patterns
         FROM pattern_stops ps
         JOIN patterns p ON p.pattern_pk = ps.pattern_pk
         JOIN routes r ON r.route_id = p.route_id AND r.agency = p.agency
         WHERE ps.stop_pk IN (SELECT value FROM json_each(?))
         GROUP BY ps.stop_pk, r.route_id, r.agency`,
        [JSON.stringify(missing)],
    );

    const best = new Map<number, Row>();
    for (const row of rows) {
        const current = best.get(row.stop_pk);
        if (!current || row.patterns > current.patterns) best.set(row.stop_pk, row);
    }
    for (const pk of missing) {
        const row = best.get(pk);
        const name = row ? row.route_short_name || row.route_long_name || '?' : '';
        cache.set(pk, row ? hexColor(row.route_color, fallbackRouteColor(row.route_type, name)) : null);
    }
}
