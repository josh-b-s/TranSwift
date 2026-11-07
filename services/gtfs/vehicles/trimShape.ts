import type { LatLng } from '@/services/db/sqliteDb';

const METRES_PER_DEG = 111_320;
/** A shape further than this from a terminal stop is probably the wrong shape, so it is left alone. */
const MAX_END_GAP_M = 500;
/** First and last stop this close means a loop line, where "nearest point to each end" can't tell the ends apart. */
const LOOP_GAP_M = 50;
/** A shape point this close to a stop already meets it, so the stop is not joined on again. */
const ON_STOP_M = 1;

function metres(a: LatLng, b: LatLng): number {
    const dLat = (a.latitude - b.latitude) * METRES_PER_DEG;
    const dLon = (a.longitude - b.longitude) * METRES_PER_DEG * Math.cos((a.latitude * Math.PI) / 180);
    return Math.hypot(dLat, dLon);
}

/**
 * GTFS shapes often run past the first and last stop (depot legs, loop-backs) and sometimes stop short of them.
 * Cuts the shape to the stretch between the first and last stop, picking the pair of points (start before end)
 * nearest to those stops, and joins the stops themselves onto the ends so the line meets them.
 * Returns the shape untouched when it can't be trusted: no stops, a loop line, or an end further than 500 m away.
 */
export function trimShapeToStops(shape: LatLng[], stops: LatLng[]): LatLng[] {
    if (shape.length < 2 || stops.length < 2) return shape;
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (metres(first, last) < LOOP_GAP_M) return shape;

    // Best start index so far (by distance to the first stop) while scanning forward for the end.
    let bestStart = 0;
    let bestStartDist = Infinity;
    let best = { start: 0, end: 0, total: Infinity, startDist: Infinity, endDist: Infinity };
    for (let j = 0; j < shape.length; j++) {
        const dFirst = metres(shape[j], first);
        if (dFirst < bestStartDist) {
            bestStartDist = dFirst;
            bestStart = j;
        }
        const dLast = metres(shape[j], last);
        const total = bestStartDist + dLast;
        if (total < best.total) best = { start: bestStart, end: j, total, startDist: bestStartDist, endDist: dLast };
    }

    if (best.end <= best.start) return shape;
    if (best.startDist > MAX_END_GAP_M || best.endDist > MAX_END_GAP_M) return shape;
    const cut = shape.slice(best.start, best.end + 1);
    return [...(best.startDist > ON_STOP_M ? [first] : []), ...cut, ...(best.endDist > ON_STOP_M ? [last] : [])];
}
