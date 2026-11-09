import type { QueryableDb } from '@/services/db/queryableDb';
import { serviceDayStartMs, type Departure } from '@/services/gtfs/departures/stopDepartures';
import { getTripStops } from '@/services/gtfs/departures/tripStops';
import type { MapVehicle } from './vehicleRoutes';

// A vehicle can be well behind its timetable, so the stop it is heading to may be scheduled long before now.
const LATE_LOOKBACK_MS = 60 * 60_000;
// With no stop reported there is nothing to go on but the clock, and a stop just left is not "next".
const JUST_PASSED_MS = 2 * 60_000;

type Vehicle = Pick<MapVehicle, 'tripId' | 'currentStopSequence' | 'routeName' | 'routeType' | 'color' | 'textColor'>;

/**
 * The vehicle's trip as a departure from the stop it is at or heading to, which is what lists the stops it has left.
 * Times in the timetable count from the start of a service day, and a trip running after midnight belongs to the day
 * before, so today and yesterday are both tried. Null when the timetable lacks the trip or it calls at nothing more.
 */
export async function vehicleDeparture(db: QueryableDb, vehicle: Vehicle, terminus: string | null, now: Date): Promise<Departure | null> {
    if (!vehicle.tripId) return null;
    const [trip] = await db.getAllAsync<{ trip_pk: number }>('SELECT trip_pk FROM trips WHERE trip_id = ? LIMIT 1', [vehicle.tripId]);
    if (!trip) return null;

    for (const offset of [0, -1]) {
        const dayStartMs = serviceDayStartMs(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset));
        const departure: Departure = {
            timeMs: now.getTime() - (vehicle.currentStopSequence === null ? JUST_PASSED_MS : LATE_LOOKBACK_MS),
            routeName: vehicle.routeName,
            routeType: vehicle.routeType,
            routeColor: vehicle.color,
            routeTextColor: vehicle.textColor,
            terminus: terminus ?? '',
            tripPk: trip.trip_pk,
            stopSequence: vehicle.currentStopSequence ?? 0,
            dayStartMs,
        };
        if ((await getTripStops(db, departure)).length > 0) return departure;
    }
    return null;
}
