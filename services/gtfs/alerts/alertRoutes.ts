import type { QueryableDb } from '@/services/db/queryableDb';
import { routeKey } from '@/services/gtfs/vehicles/vehicleRoutes';
import { isActiveAt, resolveAlert, type ResolvedAlert, type ServiceAlert } from './serviceAlert';

type RouteRow = { route_id: string; route_short_name: string | null; route_long_name: string | null; route_type: number };

/** The alerts in effect now, placed on stops and routes. Route ids are looked up in the timetable only if needed. */
export async function resolveActiveAlerts(db: QueryableDb, alerts: ServiceAlert[], nowMs: number): Promise<ResolvedAlert[]> {
    const nowSec = Math.floor(nowMs / 1000);
    const active = alerts.filter(a => isActiveAt(a, nowSec));

    const routeKeyById = new Map<string, string>();
    if (active.some(a => a.targets.some(t => t.routeId && !t.stopId && !t.tripId))) {
        const rows = await db.getAllAsync<RouteRow>('SELECT route_id, route_short_name, route_long_name, route_type FROM routes');
        // Same naming as the departures and journeys, so the keys compare equal.
        for (const r of rows) routeKeyById.set(r.route_id, routeKey(r.route_short_name || r.route_long_name || '?', r.route_type));
    }

    return active.flatMap(a => resolveAlert(a, routeKeyById) ?? []);
}
