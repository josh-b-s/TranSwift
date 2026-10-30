import type { QueryableDb } from '@/services/db/queryableDb';
import { fetchStopRealtime } from '@/services/gtfs/realtime/departureRealtime';
import { scheduledArrivalMs } from './scheduledArrival';
import type { RideStep } from './tripSteps';

/**
 * When a ride is now due at its last stop: the scheduled time moved by the delay the realtime feeds report for it.
 * Null when the ride cannot be looked up, the feeds have no delay for it, or the trip is cancelled, in which case
 * the caller keeps the arrival time it has.
 */
export async function refreshedArrivalMs(db: QueryableDb, ride: RideStep, now: Date): Promise<number | null> {
    if (ride.tripPk === undefined || ride.alightSequence === undefined || ride.arrivalMs === undefined) return null;
    const [status] = await fetchStopRealtime([{ tripPk: ride.tripPk, stopSequence: ride.alightSequence }]);
    const delaySec = status?.arrivalDelaySec ?? status?.delaySec ?? null;
    if (!status || status.cancelled || delaySec === null) return null;

    const scheduled = await scheduledArrivalMs(db, ride.tripPk, ride.alightSequence, ride.arrivalMs, now);
    return scheduled === null ? null : scheduled + delaySec * 1000;
}
