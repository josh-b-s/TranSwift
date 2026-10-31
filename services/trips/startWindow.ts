import { clockToMs } from './clock';

// A journey planned for later shouldn't start from someone who happens to walk off from its start this early.
const EARLY_MS = 20 * 60_000;
// Past the first vehicle's departure the plan is stale. A little grace covers a vehicle running late.
const LATE_MS = 2 * 60_000;

/**
 * Whether auto start fits a journey right now: from shortly before it leaves until its first vehicle has gone.
 * Times are "HH:MM:SS" clock readings, as the journey carries them.
 */
export function withinStartWindow(departureTime: string, firstBoardingTime: string | undefined, now: Date): boolean {
    const nowMs = now.getTime();
    if (nowMs < clockToMs(departureTime, now) - EARLY_MS) return false;
    return firstBoardingTime === undefined || nowMs <= clockToMs(firstBoardingTime, now) + LATE_MS;
}
