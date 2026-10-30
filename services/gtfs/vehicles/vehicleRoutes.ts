import type { QueryableDb } from '@/services/db/queryableDb';
import { fallbackRouteColor, hexColor } from '@/services/gtfs/core/routeTypeUtil';
import type { VehicleFix } from './vehicleFix';

export type RouteInfo = { routeName: string; routeType: number; color: string; textColor: string };

/** A vehicle whose route is known, so it can be labelled and coloured. */
export type MapVehicle = VehicleFix & RouteInfo;

/** Names a route the same way departures and journeys do, so they can be compared. */
export const routeKey = (routeName: string, routeType: number) => `${routeName}|${routeType}`;

export type RouteLookup = { byTripId: Map<string, RouteInfo>; byRouteId: Map<string, RouteInfo> };

type RouteRow = {
    route_short_name: string | null; route_long_name: string | null; route_type: number;
    route_color: string | null; route_text_color: string | null;
};

const CHUNK = 500;

const toInfo = (r: RouteRow): RouteInfo => {
    const routeName = r.route_short_name || r.route_long_name || '?';
    return {
        routeName,
        routeType: r.route_type,
        color: hexColor(r.route_color, fallbackRouteColor(r.route_type, routeName)),
        textColor: hexColor(r.route_text_color, '#FFFFFF'),
    };
};

const chunks = <T>(items: T[]) => Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, i) => items.slice(i * CHUNK, (i + 1) * CHUNK));
const marks = (n: number) => Array(n).fill('?').join(',');

/** Looks the feed's trip and route ids up in the timetable. Ids it does not know are left out. */
export async function loadRouteLookup(db: QueryableDb, fixes: VehicleFix[]): Promise<RouteLookup> {
    const byTripId = new Map<string, RouteInfo>();
    const byRouteId = new Map<string, RouteInfo>();

    const tripIds = [...new Set(fixes.flatMap(f => (f.tripId ? [f.tripId] : [])))];
    for (const ids of chunks(tripIds)) {
        const rows = await db.getAllAsync<RouteRow & { trip_id: string }>(
            `SELECT t.trip_id, r.route_short_name, r.route_long_name, r.route_type, r.route_color, r.route_text_color
             FROM trips t
             JOIN patterns p ON p.pattern_pk = t.pattern_pk
             JOIN routes r ON r.route_id = p.route_id AND r.agency = p.agency
             WHERE t.trip_id IN (${marks(ids.length)})`,
            ids,
        );
        for (const r of rows) if (!byTripId.has(r.trip_id)) byTripId.set(r.trip_id, toInfo(r));
    }

    const routeIds = [...new Set(fixes.flatMap(f => (f.routeId ? [f.routeId] : [])))];
    for (const ids of chunks(routeIds)) {
        const rows = await db.getAllAsync<RouteRow & { route_id: string }>(
            `SELECT route_id, route_short_name, route_long_name, route_type, route_color, route_text_color
             FROM routes WHERE route_id IN (${marks(ids.length)})`,
            ids,
        );
        for (const r of rows) if (!byRouteId.has(r.route_id)) byRouteId.set(r.route_id, toInfo(r));
    }
    return { byTripId, byRouteId };
}

/** Joins each fix to its route, preferring the trip (which names its own route) over the feed's route id. */
export function attachRoutes(fixes: VehicleFix[], lookup: RouteLookup): MapVehicle[] {
    return fixes.flatMap(fix => {
        const info = (fix.tripId && lookup.byTripId.get(fix.tripId)) || (fix.routeId && lookup.byRouteId.get(fix.routeId)) || null;
        return info ? [{ ...fix, ...info }] : [];
    });
}

/** The vehicles on the wanted routes, or all of them when `wanted` is null. Nearest first when a point is given, at most `max`. */
export function pickVehicles(
    vehicles: MapVehicle[],
    wanted: ReadonlySet<string> | null,
    max: number,
    near?: { latitude: number; longitude: number },
): MapVehicle[] {
    const onRoute = wanted ? vehicles.filter(v => wanted.has(routeKey(v.routeName, v.routeType))) : [...vehicles];
    if (!near) return onRoute.slice(0, max);
    const distance = (v: MapVehicle) => (v.latitude - near.latitude) ** 2 + ((v.longitude - near.longitude) * Math.cos((near.latitude * Math.PI) / 180)) ** 2;
    return onRoute.sort((a, b) => distance(a) - distance(b)).slice(0, max);
}
