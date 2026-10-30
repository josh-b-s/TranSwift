import type { LatLng } from '@/services/places/places';

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export type RouteProjection = {
    /** Distance from the point to the nearest part of the route. */
    offRouteM: number;
    /** Distance along the route, from its start, to that nearest part. */
    alongM: number;
};

/** Where a point sits against a polyline, or null when the line has fewer than two points. */
export function projectOnRoute(route: LatLng[], point: LatLng): RouteProjection | null {
    if (route.length < 2) return null;

    // Flat metres east and north of the point, which is plenty accurate over a few hundred metres.
    const cosLat = Math.cos(toRad(point.latitude));
    const toXY = (p: LatLng) => ({
        x: toRad(p.longitude - point.longitude) * cosLat * EARTH_RADIUS_M,
        y: toRad(p.latitude - point.latitude) * EARTH_RADIUS_M,
    });

    let best: RouteProjection = { offRouteM: Infinity, alongM: 0 };
    let alongStartM = 0;
    let a = toXY(route[0]);
    for (let i = 1; i < route.length; i++) {
        const b = toXY(route[i]);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lengthSq = dx * dx + dy * dy;
        // The point is the origin, so the closest spot on the segment is where a + t * (b - a) is nearest it.
        const t = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, -(a.x * dx + a.y * dy) / lengthSq));
        const offRouteM = Math.hypot(a.x + t * dx, a.y + t * dy);
        const lengthM = Math.sqrt(lengthSq);
        if (offRouteM < best.offRouteM) best = { offRouteM, alongM: alongStartM + t * lengthM };
        alongStartM += lengthM;
        a = b;
    }
    return best;
}
