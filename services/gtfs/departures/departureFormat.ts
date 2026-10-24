export function formatClock(timeMs: number): string {
    return new Date(timeMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Minutes until the departure, or the clock time once it is an hour or more away. */
export function formatDepartureIn(timeMs: number, nowMs: number): string {
    const minutes = Math.round((timeMs - nowMs) / 60_000);
    if (minutes < 1) return 'Now';
    return minutes < 60 ? `${minutes} min` : formatClock(timeMs);
}
