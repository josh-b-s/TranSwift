import { haversineMeters } from '@/services/geo/geoUtil';
import { secondsToArrival } from './arrivalEta';
import type { RideStep, TripStep } from './tripSteps';

const NEAR_STOP_M = 100;
// A one-stop ride alerts this long before arriving, so there is time to get ready.
const ONE_STOP_LEAD_S = 60;

type Position = { latitude: number; longitude: number };
/** `speed` is metres per second, as GPS reports it. */
type Fix = Position & { speed?: number | null };

const meters = (a: Position, b: Position) =>
    haversineMeters({ lat: a.latitude, lon: a.longitude }, { lat: b.latitude, lon: b.longitude });

/** A ride with nothing between boarding and alighting is due once the vehicle has left and is a minute away. */
function oneStopRideDue(step: RideStep, fix: Fix, now: number): boolean {
    const [boarding, alighting] = step.stops;
    if (meters(fix, boarding) <= NEAR_STOP_M) return false;

    const distance = meters(fix, alighting);
    // Covers a vehicle that is stopped, or a fix with no speed and a ride with no arrival time.
    if (distance <= NEAR_STOP_M) return true;

    const eta = secondsToArrival(distance, fix.speed, step.arrivalMs, now);
    return eta !== null && eta <= ONE_STOP_LEAD_S;
}

/**
 * Calls `onAlert` once per ride. A ride with stops in between alerts on reaching the stop before the last one.
 * A one-stop ride alerts about a minute before arriving instead, since there is no stop in between to wait for.
 */
export function createAlightAlert(steps: TripStep[], onAlert: (ride: RideStep) => void) {
    const alerted = new Set<number>();

    return (stepIndex: number, fix: Fix, now = Date.now()) => {
        const step = steps[stepIndex];
        if (step?.type !== 'transit' || alerted.has(stepIndex) || step.stops.length < 2) return;

        const ready = step.stops.length === 2
            ? oneStopRideDue(step, fix, now)
            : meters(fix, step.stops[step.stops.length - 2]) <= NEAR_STOP_M;
        if (!ready) return;

        alerted.add(stepIndex);
        onAlert(step);
    };
}
