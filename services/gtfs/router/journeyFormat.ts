// Journey times come out of the router as raw GTFS "HH:MM:SS" strings, sometimes with hours of 24 or more for
// past-midnight trips. Seconds and 24h+ hours are noise to a rider, so these are display-only; the strings stay as they are.

export function formatJourneyClock(hhmmss: string): string {
    const [hStr, mStr] = hhmmss.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (Number.isNaN(h) || Number.isNaN(m)) return hhmmss;
    const dayOffset = Math.floor(h / 24);
    const d = new Date();
    d.setHours(h % 24, m, 0, 0);
    const label = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return dayOffset > 0 ? `${label} (+${dayOffset}d)` : label;
}

export function formatJourneyDuration(mins: number): string {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatWalkDistance(meters: number): string {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
}

/** "3 min late" or "1 min early" for a boarding time the realtime feeds moved, otherwise null. */
export function formatBoardingDelay(delaySec?: number): string | null {
    const min = Math.round((delaySec ?? 0) / 60);
    if (min === 0) return null;
    return `${Math.abs(min)} min ${min > 0 ? 'late' : 'early'}`;
}
