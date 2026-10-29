import type { QueryableDb } from '@/services/db/queryableDb';
import type { VehicleFix } from '@/services/gtfs/vehicles/vehicleFix';

const CHUNK = 500;

type TripRow = { trip_pk: number; trip_id: string; pattern_pk: number };

/**
 * How many stops each vehicle still has to reach before a departure's stop, by trip. Only trips whose vehicle
 * reports both its trip id and the stop sequence it is at or heading to appear. A vehicle already past the stop
 * is left out. Zero means the stop is the vehicle's current or next one.
 */
export async function loadStopsAway(
    db: QueryableDb,
    departures: { tripPk: number; stopSequence: number }[],
    fixes: VehicleFix[],
): Promise<Map<number, number>> {
    const currentByTripId = new Map<string, number>();
    for (const fix of fixes) {
        if (fix.tripId && fix.currentStopSequence !== null) currentByTripId.set(fix.tripId, fix.currentStopSequence);
    }
    const away = new Map<number, number>();
    if (currentByTripId.size === 0) return away;

    // A loop trip can pass the stop twice, so the first call there is the one that counts.
    const stopByTrip = new Map<number, number>();
    for (const d of departures) if (!stopByTrip.has(d.tripPk)) stopByTrip.set(d.tripPk, d.stopSequence);
    const tripPks = [...stopByTrip.keys()];

    for (let i = 0; i < tripPks.length; i += CHUNK) {
        const chunk = tripPks.slice(i, i + CHUNK);
        const trips = await db.getAllAsync<TripRow>(
            `SELECT trip_pk, trip_id, pattern_pk FROM trips WHERE trip_pk IN (${chunk.map(() => '?').join(',')})`,
            chunk,
        );
        for (const trip of trips) {
            const current = currentByTripId.get(trip.trip_id);
            const here = stopByTrip.get(trip.trip_pk);
            if (current === undefined || here === undefined || current > here) continue;
            // Counted in the pattern's stops, since sequences need not be consecutive.
            const [row] = await db.getAllAsync<{ n: number }>(
                'SELECT COUNT(*) AS n FROM pattern_stops WHERE pattern_pk = ? AND stop_sequence >= ? AND stop_sequence < ?',
                [trip.pattern_pk, current, here],
            );
            away.set(trip.trip_pk, row?.n ?? 0);
        }
    }
    return away;
}
