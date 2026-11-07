import type { LatLng } from '@/services/db/sqliteDb';
import { createLineProjector } from '@/services/geo/lineProjector';
import type { TripPath } from '@/services/gtfs/vehicles/tripPath';

/** A fix this close to a trip's line counts as on it; GPS in streets drifts 10 to 25 m, and parallel streets are further apart. */
export const ON_LINE_M = 35;
/** A stop this close to the rider's path counts as passed. */
export const STOP_PASSED_M = 50;
/** Least share of fixes that must be on the line. */
export const MIN_ON_LINE_SHARE = 0.9;
/** Least fixes to judge from; fewer cannot tell a vehicle from someone standing at a stop. */
export const MIN_FIXES = 4;
/** Least distance covered along the line. Short of this the rider may just be near the route. */
export const MIN_ALONG_M = 150;
/** Least speed along the line; the same as the pace under which a rider is taken to be walking. */
export const MIN_ALONG_MPS = 2.5;
/** Least share of movement along the line that goes the trip's way, so a rider heading the other way is turned down. */
export const MIN_FORWARD_SHARE = 0.85;

export type PathFix = LatLng & { time: number };

export type TripMatch = {
    tripId: string;
    /** Share of fixes on the line, 0 to 1. */
    onLineShare: number;
    /** Distance covered along the line from the first fix to the last. */
    alongM: number;
    /** How many of the trip's stops the path went by. */
    stopsPassed: number;
    /** Where the last fix is along the line, so a mid-ride start can tell what is left of the trip. */
    lastAlongM: number;
};

function matchOne(fixes: PathFix[], trip: TripPath): TripMatch | null {
    const projector = createLineProjector(trip.line);
    const alongs: number[] = [];
    let onLine = 0;
    let hint: number | null = null;
    for (const fix of fixes) {
        const position = projector.project(fix, hint);
        if (!position) return null;
        if (position.distanceM <= ON_LINE_M) {
            onLine++;
            alongs.push(position.alongM);
            hint = position.alongM;
        }
    }
    if (onLine / fixes.length < MIN_ON_LINE_SHARE) return null;

    let forwardM = 0;
    let movedM = 0;
    for (let i = 1; i < alongs.length; i++) {
        const step = alongs[i] - alongs[i - 1];
        movedM += Math.abs(step);
        if (step > 0) forwardM += step;
    }
    const alongM = alongs[alongs.length - 1] - alongs[0];
    const elapsedS = (fixes[fixes.length - 1].time - fixes[0].time) / 1000;
    if (alongM < MIN_ALONG_M || elapsedS <= 0 || alongM / elapsedS < MIN_ALONG_MPS) return null;
    if (forwardM / movedM < MIN_FORWARD_SHARE) return null;

    // Stops are projected like fixes: passed means close to the path and between where it began and ended.
    const [firstAlong, lastAlong] = [alongs[0], alongs[alongs.length - 1]];
    const stopsPassed = trip.stops.filter(stop => {
        const position = projector.project(stop);
        return position !== null && position.distanceM <= STOP_PASSED_M
            && position.alongM >= firstAlong - STOP_PASSED_M && position.alongM <= lastAlong + STOP_PASSED_M;
    }).length;

    return { tripId: trip.tripId, onLineShare: onLine / fixes.length, alongM, stopsPassed, lastAlongM: lastAlong };
}

/**
 * Which candidate trip the rider's recent path is riding, from the path alone, so it works when tracking began
 * after boarding. The path must stay on the trip's line, cover ground along it in the trip's direction at more
 * than walking pace. Of the trips that pass, the one that went by most of its stops wins, then the tightest fit.
 * Null when no trip fits. Fixes are expected in time order and already filtered for accuracy.
 */
export function matchRecentPath(fixes: PathFix[], candidates: TripPath[]): TripMatch | null {
    if (fixes.length < MIN_FIXES) return null;
    let best: TripMatch | null = null;
    for (const trip of candidates) {
        const match = matchOne(fixes, trip);
        if (!match) continue;
        if (!best || match.stopsPassed > best.stopsPassed
            || (match.stopsPassed === best.stopsPassed && match.onLineShare > best.onLineShare)) best = match;
    }
    return best;
}
