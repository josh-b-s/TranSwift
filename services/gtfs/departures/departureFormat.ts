export function formatClock(timeMs: number): string {
    return new Date(timeMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Minutes until the departure, or the clock time once it is an hour or more away. */
export function formatDepartureIn(timeMs: number, nowMs: number): string {
    const minutes = Math.round((timeMs - nowMs) / 60_000);
    if (minutes < 1) return 'Now';
    return minutes < 60 ? `${minutes} min` : formatClock(timeMs);
}

/** "On time", "4 min late" or "2 min early". Under 30 s either way counts as on time. */
export function formatDelay(delaySec: number): string {
    const minutes = Math.round(Math.abs(delaySec) / 60);
    if (minutes === 0) return 'On time';
    return `${minutes} min ${delaySec > 0 ? 'late' : 'early'}`;
}
