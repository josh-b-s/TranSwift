import type { RepoStop } from '@/services/gtfs/core/stopRepo';
import type { RouteStop } from '@/services/gtfs/router/routeTypes';
import { haversineMeters } from '@/services/geo/geoUtil';

// Route stops come from the engine without a stop_pk, so they are matched back to the database by position.
const MAX_MATCH_M = 50;

/** The database stop a route stop refers to: the nearest within 50 m, preferring one with the same name. */
export function findRepoStop(stops: RepoStop[], target: RouteStop): RepoStop | null {
    const at = { lat: target.latitude, lon: target.longitude };
    let best: RepoStop | null = null;
    let bestScore = Infinity;
    for (const stop of stops) {
        const d = haversineMeters(at, { lat: stop.stop_lat, lon: stop.stop_lon });
        if (d > MAX_MATCH_M) continue;
        // A same-named stop beats any unnamed neighbour inside the radius.
        const score = stop.stop_name === target.name ? d : d + MAX_MATCH_M;
        if (score < bestScore) {
            best = stop;
            bestScore = score;
        }
    }
    return best;
}
