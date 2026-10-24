import { haversineMeters } from '@/services/geo/geoUtil';
import type { RideStep, TripStep } from './tripSteps';

const NEAR_STOP_M = 100;

type Position = { latitude: number; longitude: number };

const meters = (a: Position, b: Position) =>
    haversineMeters({ lat: a.latitude, lon: a.longitude }, { lat: b.latitude, lon: b.longitude });

/** Calls `onAlert` once per ride, when the rider reaches the stop before the one they get off at. */
export function createAlightAlert(steps: TripStep[], onAlert: (ride: RideStep) => void) {
    const alerted = new Set<number>();

    return (stepIndex: number, fix: Position) => {
        const step = steps[stepIndex];
        if (step?.type !== 'transit' || alerted.has(stepIndex) || step.stops.length < 2) return;

        const stopBefore = step.stops[step.stops.length - 2];
        const away = meters(fix, stopBefore) > NEAR_STOP_M;
        // With no stop in between, the stop before is the boarding stop, so wait until the vehicle has left it.
        const ready = step.stops.length === 2 ? away : !away;
        if (!ready) return;

        alerted.add(stepIndex);
        onAlert(step);
    };
}
