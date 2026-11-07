export type SpeedVerdict = { onTime: boolean; marginMps: number };

/** The average speed that covers the distance by the deadline. Null once the deadline has passed or the distance is covered. */
export function requiredSpeedMps(distanceM: number, deadlineMs: number, nowMs: number): number | null {
    const secondsLeft = (deadlineMs - nowMs) / 1000;
    if (secondsLeft <= 0 || distanceM <= 0) return null;
    return distanceM / secondsLeft;
}

/** Positive margin: faster than needed. Negative: how much faster the rider must go. */
export function speedVerdict(currentMps: number, requiredMps: number): SpeedVerdict {
    const marginMps = currentMps - requiredMps;
    return { onTime: marginMps >= 0, marginMps };
}
