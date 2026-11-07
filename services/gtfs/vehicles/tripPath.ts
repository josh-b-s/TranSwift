import type { QueryableDb } from '@/services/db/queryableDb';
import type { LatLng } from '@/services/db/sqliteDb';
import { trimShapeToStops } from './trimShape';

// Coordinates are stored as integer degrees * 1e6 (see schema.sql).
const COORD_SCALE = 1_000_000;

/** A trip named either by the timetable's key (a departure has it) or by the feed's id (a vehicle has it). */
export type TripRef = { tripPk: number } | { tripId: string };

/** The whole line a trip runs on, every stop it calls at and the name of the last. `tripId` is the feed's id, as vehicles report it. */
export type TripPath = { tripId: string; line: LatLng[]; stops: LatLng[]; terminus: string | null };

type TripRow = { trip_id: string; pattern_pk: number; agency: number; shape_id: string | null };
type PointRow = { lat: number; lon: number };
type StopRow = PointRow & { name: string };

const toLatLng = (r: PointRow): LatLng => ({ latitude: r.lat / COORD_SCALE, longitude: r.lon / COORD_SCALE });

/** Null when the timetable does not know the trip. A feed without shapes gets a line straight between the stops. */
export async function loadTripPath(db: QueryableDb, trip: TripRef): Promise<TripPath | null> {
    const [column, value] = 'tripPk' in trip ? ['t.trip_pk', trip.tripPk] : ['t.trip_id', trip.tripId];
    const [row] = await db.getAllAsync<TripRow>(
        `SELECT t.trip_id, t.pattern_pk, t.agency, p.shape_id
         FROM trips t
         JOIN patterns p ON p.pattern_pk = t.pattern_pk
         WHERE ${column} = ?
         LIMIT 1`,
        [value],
    );
    if (!row) return null;

    const stopRows = await db.getAllAsync<StopRow>(
        `SELECT s.stop_lat AS lat, s.stop_lon AS lon, s.stop_name AS name
         FROM pattern_stops ps
         JOIN stops s ON s.stop_pk = ps.stop_pk
         WHERE ps.pattern_pk = ?
         ORDER BY ps.stop_sequence`,
        [row.pattern_pk],
    );
    const shapeRows = row.shape_id === null ? [] : await db.getAllAsync<PointRow>(
        `SELECT sh.shape_pt_lat AS lat, sh.shape_pt_lon AS lon
         FROM shape_meta m
         JOIN shapes sh ON sh.shape_pk = m.shape_pk
         WHERE m.shape_id = ? AND m.agency = ?
         ORDER BY sh.shape_pt_sequence`,
        [row.shape_id, row.agency],
    );

    const stops = stopRows.map(toLatLng);
    const line = shapeRows.length > 1 ? trimShapeToStops(shapeRows.map(toLatLng), stops) : stops;
    return { tripId: row.trip_id, line, stops, terminus: stopRows.at(-1)?.name ?? null };
}
