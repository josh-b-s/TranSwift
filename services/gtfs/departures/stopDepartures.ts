import type { QueryableDb } from '@/services/db/queryableDb';
import { makeKey, parseKey } from '@/services/gtfs/core/gtfsKeyUtil';
import { fallbackRouteColor } from '@/services/gtfs/core/routeTypeUtil';
import { getActiveServiceKeys } from './activeServices';

const HOUR_MS = 3_600_000;

export type Departure = {
    timeMs: number;
    routeName: string;
    routeColor: string;
    routeTextColor: string;
    /** Name of the last stop on the trip. */
    terminus: string;
};

type DepartureRow = {
    sec: number;
    service_id: string;
    agency: number;
    route_short_name: string | null;
    route_long_name: string | null;
    route_type: number;
    route_color: string | null;
    route_text_color: string | null;
    terminus: string | null;
};

/** GTFS times count from noon minus 12 hours, which is not midnight on a daylight saving day. */
function serviceDayStartMs(day: Date): number {
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12).getTime() - 12 * HOUR_MS;
}

function hexColor(value: string | null, fallback: string): string {
    return value && /^#?[0-9a-f]{6}$/i.test(value) ? `#${value.replace('#', '')}` : fallback;
}

/**
 * Scheduled departures from one stop between `from` and `from + windowMs`, soonest first.
 * Trips that end at the stop are left out, since nobody can board them there.
 */
export async function getStopDepartures(
    db: QueryableDb,
    stopPk: number,
    from: Date,
    windowMs: number,
    limit: number,
): Promise<Departure[]> {
    const fromMs = from.getTime();
    const toMs = fromMs + windowMs;
    const out: Departure[] = [];

    // Yesterday's trips can run past midnight, and tomorrow's can start inside the window.
    for (const offset of [-1, 0, 1]) {
        const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
        const dayStartMs = serviceDayStartMs(day);
        const toSec = Math.floor((toMs - dayStartMs) / 1000);
        if (toSec < 0) continue;
        const fromSec = Math.max(0, Math.ceil((fromMs - dayStartMs) / 1000));

        const services = await getActiveServiceKeys(db, day);
        if (services.size === 0) continue;
        const serviceIds = [...new Set([...services].map(key => parseKey(key).id))];

        const rows = await db.getAllAsync<DepartureRow>(
            `SELECT st.departure_sec AS sec, t.service_id, t.agency,
                    r.route_short_name, r.route_long_name, r.route_type,
                    r.route_color, r.route_text_color,
                    term.stop_name AS terminus
             FROM stop_times st
             JOIN trips t ON t.trip_pk = st.trip_pk
             JOIN patterns p ON p.pattern_pk = t.pattern_pk
             JOIN routes r ON r.route_id = p.route_id AND r.agency = p.agency
             JOIN pattern_stops ps ON ps.pattern_pk = p.pattern_pk
              AND ps.stop_sequence = (SELECT MAX(stop_sequence) FROM pattern_stops WHERE pattern_pk = p.pattern_pk)
             JOIN stops term ON term.stop_pk = ps.stop_pk
             WHERE st.stop_pk = ?
               AND st.departure_sec BETWEEN ? AND ?
               AND t.service_id IN (SELECT value FROM json_each(?))
               AND st.stop_sequence < (SELECT MAX(stop_sequence) FROM stop_times WHERE trip_pk = st.trip_pk)
             ORDER BY st.departure_sec`,
            [stopPk, fromSec, toSec, JSON.stringify(serviceIds)],
        );

        for (const r of rows) {
            // The SQL filter matches service_id alone, so two agencies can share an id.
            if (!services.has(makeKey(r.agency, r.service_id))) continue;
            const routeName = r.route_short_name || r.route_long_name || '?';
            out.push({
                timeMs: dayStartMs + r.sec * 1000,
                routeName,
                routeColor: hexColor(r.route_color, fallbackRouteColor(r.route_type, routeName)),
                routeTextColor: hexColor(r.route_text_color, '#FFFFFF'),
                terminus: r.terminus ?? '',
            });
        }
    }

    return out.sort((a, b) => a.timeMs - b.timeMs).slice(0, limit);
}
