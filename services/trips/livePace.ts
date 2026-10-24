export type WalkProgress = { distanceM: number; elapsedS: number };

// Early readings swing a lot while GPS settles and the first steps are taken.
const MIN_DISTANCE_M = 50;

/**
 * Seconds ahead (positive) or behind (negative) of a personal best, judged at the distance
 * walked so far. The best is stored as an average speed, so it is treated as an even pace.
 */
export function paceAgainstBest({ distanceM, elapsedS }: WalkProgress, bestAvgMps: number): number | null {
    if (distanceM < MIN_DISTANCE_M) return null;
    return distanceM / bestAvgMps - elapsedS;
}
