import { projectOnRoute } from '@/services/geo/routeProjection';
import type { LatLng } from '@/services/places/places';

/** How far from the route a fix may be and still count as on it. */
export const ON_ROUTE_M = 30;
/** How far forward along the route the rider must get before it counts as following it. */
export const FOLLOW_DISTANCE_M = 50;
// Worse fixes jump around more than FOLLOW_DISTANCE_M, so a rider standing still could trigger.
const MAX_ACCURACY_M = 25;

export type FollowFix = LatLng & { accuracyM: number | null };

/** Tells when a rider has started following a route: on it, and moved forward along it. */
export function createFollowDetector(route: LatLng[]) {
    // Where along the route the rider was first seen on it.
    let startM: number | null = null;

    return {
        update(fix: FollowFix): boolean {
            if (fix.accuracyM === null || fix.accuracyM > MAX_ACCURACY_M) return false;
            const hit = projectOnRoute(route, fix);
            if (!hit || hit.offRouteM > ON_ROUTE_M) {
                startM = null;
                return false;
            }
            startM = startM === null ? hit.alongM : Math.min(startM, hit.alongM);
            return hit.alongM - startM >= FOLLOW_DISTANCE_M;
        },
    };
}
