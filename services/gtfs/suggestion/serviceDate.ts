const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from now until a GTFS YYYYMMDD date. Negative once it has passed. */
export function daysUntilGtfsDate(yyyymmdd: string, now = Date.now()): number {
    const end = Date.UTC(+yyyymmdd.slice(0, 4), +yyyymmdd.slice(4, 6) - 1, +yyyymmdd.slice(6, 8));
    return Math.floor((end - now) / DAY_MS);
}
