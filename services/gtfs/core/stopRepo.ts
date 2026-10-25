import type { QueryableDb } from '../../db/queryableDb';

// Coordinates are stored as integer degrees * 1e6 (see scripts/preprocess-gtfs.ts).
const COORD_SCALE = 1_000_000;

export interface RepoStop {
    stop_pk: number;
    stop_id: string;
    stop_name: string;
    stop_lat: number; // degrees, already unpacked
    stop_lon: number; // degrees, already unpacked
    agency: number;
}

let stopsCache: RepoStop[] | null = null;
let stopsLoading: Promise<RepoStop[]> | null = null;

async function loadStops(db: QueryableDb): Promise<RepoStop[]> {
    const rows = await db.getAllAsync<RepoStop>(
        `SELECT stop_pk, stop_id, stop_name, stop_lat, stop_lon, agency
         FROM stops`,
    );
    return rows.map(r => ({ ...r, stop_lat: r.stop_lat / COORD_SCALE, stop_lon: r.stop_lon / COORD_SCALE }));
}

/** Every stop in the active database. Loaded once; call invalidateStopCache() when the database changes. */
export function getAllStopsCached(db: QueryableDb): Promise<RepoStop[]> {
    if (stopsCache) return Promise.resolve(stopsCache);
    if (stopsLoading) return stopsLoading;

    const loading: Promise<RepoStop[]> = loadStops(db).then(rows => {
        // A database switch during the load clears stopsLoading, so the old rows are dropped.
        if (stopsLoading === loading) stopsCache = rows;
        return rows;
    });
    loading.catch(() => {
        if (stopsLoading === loading) stopsLoading = null;
    });
    stopsLoading = loading;
    return loading;
}

export function invalidateStopCache(): void {
    stopsCache = null;
    stopsLoading = null;
}
