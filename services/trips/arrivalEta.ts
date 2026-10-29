// Below this the vehicle is stopped or crawling, and distance / speed would run far too long.
const MIN_SPEED_MPS = 1.5;

/**
 * Seconds until a vehicle reaches a stop. From distance and speed while it is moving, since that follows the
 * vehicle as it is now. Otherwise from the planned arrival time, if there is one. Null when neither is usable.
 * Negative when the planned arrival has passed.
 */
export function secondsToArrival(
    distanceM: number,
    speedMps: number | null | undefined,
    arrivalMs: number | undefined,
    nowMs: number,
): number | null {
    if (speedMps != null && speedMps >= MIN_SPEED_MPS) return distanceM / speedMps;
    if (arrivalMs !== undefined) return (arrivalMs - nowMs) / 1000;
    return null;
}
