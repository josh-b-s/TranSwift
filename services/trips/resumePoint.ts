import type { MidRideResume } from './midRideResume';
import type { TripStep } from './tripSteps';

// Long enough to start the same trip again after a stop for coffee, short enough that the plan is still live.
const MAX_AGE_MS = 2 * 60 * 60_000;

type Saved = { key: string; stepIndex: number; reachedStop: number; savedAt: number };

let saved: Saved | null = null;

/** The same journey gives the same key, whatever time it is started at. */
export const tripKey = (steps: TripStep[]): string =>
    steps.map(s => (s.type === 'transit' ? `ride:${s.tripPk ?? s.routeName}:${s.from}>${s.to}` : `walk:${s.from}>${s.to}`)).join('|');

/**
 * Notes where a trip ended early so starting it again can carry on. `stopsLeft` is the ride's remaining stops, or null
 * on a walk. A trip stopped before anything was done has nothing to resume.
 */
export function rememberResumePoint(steps: TripStep[], stepIndex: number, boarded: boolean, stopsLeft: number | null, now: number): void {
    const step = steps[stepIndex];
    if (!step || (stepIndex === 0 && !boarded)) return;
    const reachedStop = step.type === 'transit' && stopsLeft !== null ? step.stops.length - 1 - stopsLeft : 0;
    saved = { key: tripKey(steps), stepIndex, reachedStop, savedAt: now };
}

/** Where to carry on if these steps are the trip that ended early recently, otherwise null. */
export function resumePointFor(steps: TripStep[], now: number): MidRideResume | null {
    if (!saved || saved.key !== tripKey(steps) || now - saved.savedAt > MAX_AGE_MS) return null;
    return { steps: steps.slice(saved.stepIndex), reachedStop: saved.reachedStop };
}

export function forgetResumePoint(): void {
    saved = null;
}
