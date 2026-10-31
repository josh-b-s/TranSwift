import { haversineMeters } from '@/services/geo/geoUtil';
import type { RouteStop } from '@/services/gtfs/router/routeTypes';

const AT_STOP_M = 100;

type Position = { latitude: number; longitude: number };

/**
 * Counts the stops a ride has left, from the rider's fixes. A stop counts as reached once a fix is within
 * `AT_STOP_M` of it, and the count never goes back up. Underground or without a fix it holds its last value.
 */
export function createRideProgress(stops: RouteStop[]) {
    let reached = 0;

    return {
        /** Stops still to go, counting the one the rider gets off at. */
        get stopsLeft() { return stops.length - 1 - reached; },

        update(fix: Position): number {
            let nearestM = AT_STOP_M;
            for (let i = reached + 1; i < stops.length; i++) {
                const m = haversineMeters(
                    { lat: fix.latitude, lon: fix.longitude },
                    { lat: stops[i].latitude, lon: stops[i].longitude },
                );
                if (m <= nearestM) {
                    nearestM = m;
                    reached = i;
                }
            }
            return this.stopsLeft;
        },
    };
}
