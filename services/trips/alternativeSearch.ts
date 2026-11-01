import { haversineMeters } from '@/services/geo/geoUtil';
import type { LatLng } from '@/services/places/places';
import type { GtfsJourney, RouteStop } from '@/services/gtfs/router/routeTypes';
import { secondsToArrival } from './arrivalEta';
import type { TripStep } from './tripSteps';

// Used when the vehicle's speed gives no usable estimate. Clamped so a stalled or racing reading can't send the search far off.
const DEFAULT_WAIT_S = 120;
const MIN_WAIT_S = 30;
const MAX_WAIT_S = 600;

export type SearchStart = {
    origin: LatLng;
    /** Where the search starts, as it reads in "Alternatives from …". */
    label: string;
    departAt: Date;
    /** The stop the vehicle reaches next when the rider is on it, which is where they can get off. Null when searching from where they stand. */
    via: RouteStop | null;
};

const metres = (a: LatLng, b: LatLng) =>
    haversineMeters({ lat: a.latitude, lon: a.longitude }, { lat: b.latitude, lon: b.longitude });

/**
 * Where a search for alternatives should start. On a vehicle that is the next stop, since nobody can get off between
 * stops, at the time the vehicle gets there. Otherwise it is where the rider stands, right now.
 */
export function alternativeStart(
    steps: TripStep[],
    stepIndex: number,
    stopsLeft: number | null,
    here: LatLng,
    speedMps: number | null,
    now: Date,
): SearchStart {
    const step = steps[stepIndex];
    if (step?.type === 'transit' && stopsLeft !== null && stopsLeft >= 1) {
        const next = step.stops[step.stops.length - stopsLeft];
        if (next) {
            const etaS = secondsToArrival(metres(here, next), speedMps, undefined, now.getTime()) ?? DEFAULT_WAIT_S;
            const waitS = Math.min(MAX_WAIT_S, Math.max(MIN_WAIT_S, etaS));
            return {
                origin: { latitude: next.latitude, longitude: next.longitude },
                label: next.name,
                departAt: new Date(now.getTime() + waitS * 1000),
                via: next,
            };
        }
    }
    return { origin: here, label: 'your location', departAt: now, via: null };
}

export type AvoidRoute = { name: string; type: number };

/** The route of the ride the rider is on or about to take, which is the one a disruption would hurt. */
export function routeToAvoid(steps: TripStep[], stepIndex: number): AvoidRoute | null {
    for (let i = stepIndex; i < steps.length; i++) {
        const step = steps[i];
        if (step.type === 'transit') return { name: step.routeName, type: step.routeType };
    }
    return null;
}

export const usesRoute = (journey: GtfsJourney, route: AvoidRoute) =>
    journey.legs.some(leg => leg.routeName === route.name && leg.routeType === route.type);
