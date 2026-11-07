import { createLineProjector } from '@/services/geo/lineProjector';
import type { TripPath } from '@/services/gtfs/vehicles/tripPath';
import type { TripStep } from './tripSteps';
import { STOP_PASSED_M, type TripMatch } from './vehicleMatch';

/** A ride step of the journey and the line of the trip it is on. */
export type RideCandidate = { stepIndex: number; path: TripPath };

/** What to follow for a rider who joined a ride part way: the steps from that ride on, and the stop they are already past. */
export type MidRideResume = { steps: TripStep[]; reachedStop: number };

/** The ride steps whose trip can be looked up, by step index. */
export function rideStepTrips(steps: TripStep[]): { stepIndex: number; tripPk: number }[] {
    return steps.flatMap((step, stepIndex) =>
        step.type === 'transit' && step.tripPk !== undefined ? [{ stepIndex, tripPk: step.tripPk }] : []);
}

/**
 * Turns a path match into where to carry on from. Null when the matched trip is not one of the candidates, or the
 * rider is already at the stop they get off at, since there is nothing left to follow.
 */
export function resumeFromMatch(steps: TripStep[], candidates: RideCandidate[], match: TripMatch): MidRideResume | null {
    const candidate = candidates.find(c => c.path.tripId === match.tripId);
    const step = candidate && steps[candidate.stepIndex];
    if (!candidate || step?.type !== 'transit') return null;

    const projector = createLineProjector(candidate.path.line);
    let reachedStop = 0;
    step.stops.forEach((stop, i) => {
        const position = projector.project(stop);
        if (position && position.alongM <= match.lastAlongM + STOP_PASSED_M) reachedStop = i;
    });
    if (reachedStop >= step.stops.length - 1) return null;
    return { steps: steps.slice(candidate.stepIndex), reachedStop };
}
