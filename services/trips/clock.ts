/** Today at a "HH:MM:SS" time of day. A time hours in the past is taken to be tomorrow, for a trip that crosses midnight. */
export function clockToMs(clock: string, now: Date): number {
    const [h, m, s] = clock.split(':').map(Number);
    const d = new Date(now);
    d.setHours(h, m, s, 0);
    return d.getTime() < now.getTime() - 6 * 3_600_000 ? d.getTime() + 24 * 3_600_000 : d.getTime();
}
