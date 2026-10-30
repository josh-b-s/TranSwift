import type { QueryableDb } from '@/services/db/queryableDb';
import { fallbackRouteColor, hexColor } from '@/services/gtfs/core/routeTypeUtil';
import type { LiveDeparture } from './liveDepartures';

/** A trip that exists only in the realtime feed, leaving a stop at `timeMs`. */
export type AddedDeparture = {
    routeId: string | null;
    agency: number;
    timeMs: number;
    lastStopPk: number;
};

type RouteRow = {
    route_short_name: string | null;
    route_long_name: string | null;
    route_type: number;
    route_color: string | null;
    route_text_color: string | null;
};

/**
 * Departure rows for the added trips, named and coloured from the timetable's routes and stops. A trip whose route
 * is unknown still gets a row, with a plain badge. They are not in the timetable, so they have no stops to
 * expand: `added` is set, and the `tripPk` is a negative number that only keeps rows apart. Those already gone by
 * `nowMs` are left out.
 */
export async function addedToLiveDepartures(db: QueryableDb, added: AddedDeparture[], nowMs: number): Promise<LiveDeparture[]> {
    const routes = new Map<string, RouteRow | null>();
    const stopNames = new Map<number, string>();
    const out: LiveDeparture[] = [];

    for (const trip of added) {
        if (trip.timeMs < nowMs) continue;

        const routeKey = `${trip.agency}:${trip.routeId}`;
        if (!routes.has(routeKey)) {
            const [row] = trip.routeId === null ? [] : await db.getAllAsync<RouteRow>(
                `SELECT route_short_name, route_long_name, route_type, route_color, route_text_color
                   FROM routes WHERE route_id = ? AND agency = ?`,
                [trip.routeId, trip.agency],
            );
            routes.set(routeKey, row ?? null);
        }
        if (!stopNames.has(trip.lastStopPk)) {
            const [row] = await db.getAllAsync<{ stop_name: string }>('SELECT stop_name FROM stops WHERE stop_pk = ?', [trip.lastStopPk]);
            stopNames.set(trip.lastStopPk, row?.stop_name ?? '');
        }

        const route = routes.get(routeKey) ?? null;
        const routeName = route ? route.route_short_name || route.route_long_name || '?' : '?';
        const routeType = route?.route_type ?? 3;
        const day = new Date(trip.timeMs);
        out.push({
            timeMs: trip.timeMs,
            routeName,
            routeType,
            routeColor: hexColor(route?.route_color ?? null, fallbackRouteColor(routeType, routeName)),
            routeTextColor: hexColor(route?.route_text_color ?? null, '#FFFFFF'),
            terminus: stopNames.get(trip.lastStopPk) ?? '',
            tripPk: -(out.length + 1),
            stopSequence: 0,
            dayStartMs: new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime(),
            liveTimeMs: trip.timeMs,
            delaySec: null,
            cancelled: false,
            skipped: false,
            added: true,
        });
    }
    return out;
}
