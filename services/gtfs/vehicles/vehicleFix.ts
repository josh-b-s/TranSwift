/** One vehicle position as reported by a VehiclePositions feed. `routeId` and `tripId` are the feed's own ids. */
export type VehicleFix = {
    key: string;
    label: string | null;
    tripId: string | null;
    routeId: string | null;
    latitude: number;
    longitude: number;
    /** Degrees clockwise from north. */
    bearing: number | null;
    speedMps: number | null;
    /** Seconds since the epoch. Null when the feed gives none. */
    timestampSec: number | null;
    /** The stop sequence the vehicle is at or heading to, as the timetable numbers it. Null when the feed gives none. */
    currentStopSequence: number | null;
};

/** A vehicle last heard from longer ago than this is probably out of service, not stuck in traffic. */
export const MAX_FIX_AGE_SEC = 5 * 60;

/**
 * Drops stale fixes and keeps the newest when feeds repeat a vehicle. A fix with no timestamp is kept, since the
 * feed gives no way to tell.
 */
export function freshVehicles(fixes: VehicleFix[], nowMs: number, maxAgeSec = MAX_FIX_AGE_SEC): VehicleFix[] {
    const newest = new Map<string, VehicleFix>();
    for (const fix of fixes) {
        if (fix.timestampSec !== null && nowMs / 1000 - fix.timestampSec > maxAgeSec) continue;
        const known = newest.get(fix.key);
        if (!known || (fix.timestampSec ?? 0) >= (known.timestampSec ?? 0)) newest.set(fix.key, fix);
    }
    return [...newest.values()];
}
