import type { PathFix } from './vehicleMatch';
import type { FollowFix } from './followDetector';

/** Long enough for the vehicle matcher to see a few hundred metres of ride, short enough to stay about the current trip. */
export const RECENT_MS = 120_000;
// The matcher judges fixes against a 35 m line, so a fix looser than this proves nothing.
const MAX_ACCURACY_M = 25;

/** The rider's recent fixes with `fix` added at `now`, dropping fixes too loose to use and those older than `RECENT_MS`. */
export function addRecentFix(recent: PathFix[], fix: FollowFix, now: number): PathFix[] {
    const kept = recent.filter(f => now - f.time <= RECENT_MS);
    if (fix.accuracyM === null || fix.accuracyM > MAX_ACCURACY_M) return kept;
    return [...kept, { latitude: fix.latitude, longitude: fix.longitude, time: now }];
}
