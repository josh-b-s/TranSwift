import { haversineMeters } from '@/services/geo/geoUtil';
import type { LatLng } from '@/services/places/places';
import { encodePath, type Sample } from './pathCodec';
import type { WalkProgress } from './livePace';
import { createRideProgress } from './rideProgress';
import { rideBetween } from './switchRoute';
import type { RideStep, TripStep } from './tripSteps';
import type { RideLeg, SavedLeg } from './tripStore';

const ARRIVE_RADIUS_M = 40;
const MAX_ACCURACY_M = 30;
// Faster than anyone walks or runs for long, so the rider is in a vehicle.
const BOARD_SPEED_MPS = 4;
// Far enough from the boarding stop to have left it on the vehicle. A short ride counts at half its length.
const BOARD_DISTANCE_M = 300;
const MIN_BOARD_DISTANCE_M = 60;
// Skipping ahead needs the rider at walking pace, at a later step's end on this many fixes in a row.
const SKIP_WALKING_MPS = 3;
const SKIP_FIXES = 2;
// Held this long, a speed above a sprint means a walk step has turned into a ride on some vehicle.
const VEHICLE_MPS = 4.5;
const VEHICLE_SUSTAIN_MS = 10_000;
// A rider on a vehicle who has crept this far at walking pace for this long has most likely got off. A vehicle
// waiting at a stop is slow too, but doesn't go anywhere.
const SLOW_MPS = 2.5;
const LEFT_AFTER_MS = 30_000;
const LEFT_DISTANCE_M = 40;
// Fixes within this of the start of a slow stretch are the vehicle waiting, not the walk.
const WALK_START_M = 15;

/** `speed` is metres per second, as GPS reports it. */
export type Fix = Sample & { accuracy: number | null; speed?: number | null };

type Point = { latitude: number; longitude: number };

const metersBetween = (a: Point, b: Point) =>
    haversineMeters({ lat: a.latitude, lon: a.longitude }, { lat: b.latitude, lon: b.longitude });

/** Speed from the fix when it reports one, otherwise from the move since the last fix. Null when neither is known. */
function speedOf(fix: Fix, previous: Fix | null): number | null {
    if (typeof fix.speed === 'number' && fix.speed >= 0) return fix.speed;
    if (!previous) return null;
    const elapsedS = (fix.time - previous.time) / 1000;
    return elapsedS > 0 ? metersBetween(fix, previous) / elapsedS : null;
}

/** Whether a fix shows the rider has left the boarding stop on the vehicle. A ride with no stops listed can't tell, so counts as boarded. */
function hasBoarded(step: RideStep, fix: Fix, mps: number | null): boolean {
    const boarding = step.stops[0];
    if (!boarding) return true;
    if ((mps ?? 0) >= BOARD_SPEED_MPS) return true;
    const rideM = metersBetween(boarding, step.stops[step.stops.length - 1]);
    const needed = Math.min(BOARD_DISTANCE_M, Math.max(MIN_BOARD_DISTANCE_M, rideM / 2));
    return metersBetween(fix, boarding) >= needed;
}

const pathLengthM = (path: Sample[]) =>
    path.reduce((sum, p, i) => (i === 0 ? 0 : sum + metersBetween(path[i - 1], p)), 0);

/** The walking part of a slow stretch on a vehicle: from just before the rider moved off, leaving out the wait. */
function walkingStretch(run: Fix[]): Sample[] {
    if (run.length < 2) return [];
    const moved = run.findIndex(f => metersBetween(f, run[0]) >= WALK_START_M);
    const from = moved <= 0 ? 0 : moved - 1;
    return run.slice(from).map(({ latitude, longitude, time }) => ({ latitude, longitude, time }));
}

const isNear = (fix: Sample, target: LatLng) =>
    haversineMeters(
        { lat: fix.latitude, lon: fix.longitude },
        { lat: target.latitude, lon: target.longitude },
    ) <= ARRIVE_RADIUS_M;

export const rideLegOf = (step: RideStep, stepIndex: number): RideLeg => ({
    kind: 'ride',
    stepIndex,
    from: step.from,
    to: step.to,
    routeName: step.routeName,
    routeType: step.routeType,
    routeColor: step.routeColor,
    routeTextColor: step.routeTextColor,
    line: step.line,
});

/**
 * Walks through a journey's steps from GPS fixes, recording the rider's path on walks and the line on rides.
 * A step that was never finished because the rider got ahead of it (got off early and walked on to a later
 * stop) is closed with what was actually ridden, and the walk in between is recorded as a walk of its own.
 */
export function createTripSession(steps: TripStep[]) {
    let index = 0;
    let samples: Sample[] = [];
    let walkedM = 0;
    // Whether the rider is on the vehicle, for a ride step. A ride can't end before it, so passing its last stop early doesn't count.
    let boarded = false;
    let progress: ReturnType<typeof createRideProgress> | null = null;
    // Fixes in a row at walking pace on a ride step, which is the walk if the rider got off.
    let slowRun: Fix[] = [];
    let skip: { to: number; fixes: number } | null = null;
    // Where a run of vehicle speed began on a walk step, as an index into its samples.
    let fastFrom: { at: number; time: number } | null = null;
    let onVehicle = false;
    let left: { stopName: string } | null = null;
    let leftShown = false;
    let lastFix: Fix | null = null;
    const legs: SavedLeg[] = [];

    const resetStep = () => {
        samples = [];
        walkedM = 0;
        boarded = false;
        progress = null;
        slowRun = [];
        skip = null;
        fastFrom = null;
        onVehicle = false;
        left = null;
        leftShown = false;
    };

    const walkLeg = (stepIndex: number, step: { from: string; to: string }, path: Sample[], extra: Partial<SavedLeg>): SavedLeg =>
        ({ kind: 'walk', stepIndex, from: step.from, to: step.to, path: encodePath(path), ...extra }) as SavedLeg;

    const finishStep = () => {
        const step = steps[index];
        if (step.type === 'transit') {
            legs.push(rideLegOf(step, index));
        } else if (samples.length > 1) {
            legs.push(walkLeg(index, step, samples, { bestKey: step.bestKey }));
        }
        resetStep();
        index += 1;
    };

    /** What was ridden on the current ride step, up to the last stop reached. Null when the rider hadn't got past the boarding stop. */
    const riddenPart = (step: RideStep): RideLeg | null =>
        progress && progress.reached > 0 ? rideLegOf(rideBetween(step, 0, progress.reached), index) : null;

    const lastStopName = (step: RideStep) => (progress && progress.reached > 0 ? step.stops[progress.reached].name : step.from);

    /** Closes the current ride step and every step up to `target`, which the rider has reached ahead of time. */
    const skipTo = (target: number) => {
        const step = steps[index];
        if (step.type === 'transit') {
            const ridden = riddenPart(step);
            if (ridden) legs.push(ridden);
            const path = walkingStretch(slowRun);
            if (path.length > 1) {
                legs.push(walkLeg(target, { from: lastStopName(step), to: steps[target].to }, path, {}));
            }
        }
        resetStep();
        index = target + 1;
    };

    const checkBoarded = (fix: Fix, mps: number | null) => {
        const step = steps[index];
        if (step?.type !== 'transit' || boarded) return;
        boarded = hasBoarded(step, fix, mps);
        if (boarded) progress = createRideProgress(step.stops);
    };

    return {
        get stepIndex() { return index; },
        get done() { return index >= steps.length; },
        get legs() { return legs; },
        /** Whether the rider is on the vehicle of the current ride step. False on a walk. */
        get boarded() { return boarded; },
        /** Stops left on the current ride, counting the one to get off at. Null when not on a vehicle. */
        get stopsLeft(): number | null { return boarded && progress ? progress.stopsLeft : null; },
        /** Set once the rider on a vehicle looks to have got off before their stop; stays set until the step ends. */
        get leftVehicle() { return left; },
        /** What the current step has recorded so far, as legs, for a trip ended or switched before the step finished. */
        get inProgress(): SavedLeg[] {
            const step = steps[index];
            if (!step) return [];
            if (step.type === 'walk') {
                return samples.length > 1 ? [walkLeg(index, step, samples, { incomplete: true })] : [];
            }
            const out: SavedLeg[] = [];
            const ridden = riddenPart(step);
            if (ridden) out.push(ridden);
            const path = walkingStretch(slowRun);
            if (left && path.length > 1) out.push(walkLeg(index, { from: lastStopName(step), to: step.to }, path, { incomplete: true }));
            return out;
        },
        /** Distance and time on the current walk so far, or null when not walking. */
        get walkProgress(): WalkProgress | null {
            if (samples.length < 2) return null;
            return { distanceM: walkedM, elapsedS: (samples[samples.length - 1].time - samples[0].time) / 1000 };
        },

        addFix(fix: Fix) {
            const { latitude, longitude, time, accuracy } = fix;
            if (index >= steps.length) return;
            if (accuracy === null || accuracy > MAX_ACCURACY_M) return;
            const mps = speedOf(fix, lastFix);
            lastFix = fix;
            checkBoarded(fix, mps);

            const current = steps[index];
            if (current.type === 'walk') {
                // Vehicle speed held for a while means this is no longer walking: drop that stretch and stop recording.
                if (!onVehicle) {
                    if (mps !== null && mps >= VEHICLE_MPS) {
                        fastFrom ??= { at: samples.length, time };
                        if (time - fastFrom.time >= VEHICLE_SUSTAIN_MS) {
                            samples.length = fastFrom.at;
                            walkedM = pathLengthM(samples);
                            onVehicle = true;
                        }
                    } else {
                        fastFrom = null;
                    }
                }
                if (!onVehicle) {
                    const last = samples[samples.length - 1];
                    if (last) walkedM += metersBetween(last, fix);
                    samples.push({ latitude, longitude, time });
                }
            } else if (mps !== null) {
                slowRun = mps < SLOW_MPS ? [...slowRun, fix] : [];
            }
            if (progress && boarded) progress.update(fix);

            // A loop, since a very short step can already be satisfied by the same fix.
            while (index < steps.length && isNear(fix, steps[index].end) && (steps[index].type !== 'transit' || boarded)) {
                finishStep();
                checkBoarded(fix, mps);
            }
            if (index >= steps.length) return;

            const step = steps[index];
            if (step.type !== 'transit') return;

            // Got ahead of the ride: at walking pace at a later step's end, on consecutive fixes.
            const ahead = mps !== null && mps < SKIP_WALKING_MPS
                ? steps.findIndex((s, k) => k > index && isNear(fix, s.end))
                : -1;
            if (ahead >= 0) {
                skip = { to: ahead, fixes: skip?.to === ahead ? skip.fixes + 1 : 1 };
                if (skip.fixes >= SKIP_FIXES) skipTo(ahead);
                return;
            }
            skip = null;

            if (boarded && !leftShown && slowRun.length > 1) {
                const first = slowRun[0];
                if (time - first.time >= LEFT_AFTER_MS && metersBetween(fix, first) >= LEFT_DISTANCE_M) {
                    left = { stopName: lastStopName(step) };
                    leftShown = true;
                }
            }
        },
    };
}
