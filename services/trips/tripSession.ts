import { haversineMeters } from '@/services/geo/geoUtil';
import type { LatLng } from '@/services/places/places';
import { encodePath, type Sample } from './pathCodec';
import type { WalkProgress } from './livePace';
import type { RideStep, TripStep } from './tripSteps';
import type { SavedLeg, WalkLeg } from './tripStore';

const ARRIVE_RADIUS_M = 40;
const MAX_ACCURACY_M = 30;
// Faster than anyone walks or runs for long, so the rider is in a vehicle.
const BOARD_SPEED_MPS = 4;
// Far enough from the boarding stop to have left it on the vehicle. A short ride counts at half its length.
const BOARD_DISTANCE_M = 300;
const MIN_BOARD_DISTANCE_M = 60;

/** `speed` is metres per second, as GPS reports it. */
export type Fix = Sample & { accuracy: number | null; speed?: number | null };

const metersBetween = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) =>
    haversineMeters({ lat: a.latitude, lon: a.longitude }, { lat: b.latitude, lon: b.longitude });

/** Whether a fix shows the rider has left the boarding stop on the vehicle. A ride with no stops listed can't tell, so counts as boarded. */
function hasBoarded(step: RideStep, fix: Fix): boolean {
    const boarding = step.stops[0];
    if (!boarding) return true;
    if ((fix.speed ?? 0) >= BOARD_SPEED_MPS) return true;
    const rideM = metersBetween(boarding, step.stops[step.stops.length - 1]);
    const needed = Math.min(BOARD_DISTANCE_M, Math.max(MIN_BOARD_DISTANCE_M, rideM / 2));
    return metersBetween(fix, boarding) >= needed;
}

const isNear = (fix: Sample, target: LatLng) =>
    haversineMeters(
        { lat: fix.latitude, lon: fix.longitude },
        { lat: target.latitude, lon: target.longitude },
    ) <= ARRIVE_RADIUS_M;

/** Walks through a journey's steps from GPS fixes, recording the rider's path on walks and the line on rides. */
export function createTripSession(steps: TripStep[]) {
    let index = 0;
    let samples: Sample[] = [];
    let walkedM = 0;
    // Whether the rider is on the vehicle, for a ride step. A ride can't end before it, so passing its last stop early doesn't count.
    let boarded = false;
    const legs: SavedLeg[] = [];

    const finishStep = () => {
        const step = steps[index];
        if (step.type === 'transit') {
            legs.push({
                kind: 'ride',
                stepIndex: index,
                from: step.from,
                to: step.to,
                routeName: step.routeName,
                routeType: step.routeType,
                routeColor: step.routeColor,
                routeTextColor: step.routeTextColor,
                line: step.line,
            });
        } else if (samples.length > 1) {
            legs.push({
                kind: 'walk',
                stepIndex: index,
                from: step.from,
                to: step.to,
                bestKey: step.bestKey,
                path: encodePath(samples),
            });
        }
        samples = [];
        walkedM = 0;
        boarded = false;
        index += 1;
    };

    const checkBoarded = (fix: Fix) => {
        const step = steps[index];
        if (step?.type === 'transit' && !boarded) boarded = hasBoarded(step, fix);
    };

    return {
        get stepIndex() { return index; },
        get done() { return index >= steps.length; },
        get legs() { return legs; },
        /** The walk the rider is partway through, or null when not walking or not yet moved. For a trip ended early. */
        get unfinishedWalk(): WalkLeg | null {
            const step = steps[index];
            if (step?.type !== 'walk' || samples.length < 2) return null;
            return { kind: 'walk', stepIndex: index, from: step.from, to: step.to, path: encodePath(samples), incomplete: true };
        },
        /** Whether the rider is on the vehicle of the current ride step. False on a walk. */
        get boarded() { return boarded; },
        /** Distance and time on the current walk so far, or null when not walking. */
        get walkProgress(): WalkProgress | null {
            if (samples.length < 2) return null;
            return { distanceM: walkedM, elapsedS: (samples[samples.length - 1].time - samples[0].time) / 1000 };
        },

        addFix(fix: Fix) {
            const { latitude, longitude, time, accuracy } = fix;
            if (index >= steps.length) return;
            if (accuracy === null || accuracy > MAX_ACCURACY_M) return;
            checkBoarded(fix);

            if (steps[index].type === 'walk') {
                const last = samples[samples.length - 1];
                if (last) walkedM += haversineMeters(
                    { lat: last.latitude, lon: last.longitude },
                    { lat: latitude, lon: longitude },
                );
                samples.push({ latitude, longitude, time });
            }
            // A loop, since a very short step can already be satisfied by the same fix.
            while (index < steps.length && isNear({ latitude, longitude, time }, steps[index].end) && (steps[index].type !== 'transit' || boarded)) {
                finishStep();
                checkBoarded(fix);
            }
        },
    };
}
