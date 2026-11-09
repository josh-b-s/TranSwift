import type { QueryableDb } from '@/services/db/queryableDb';
import { makeKey, parseKey } from '@/services/gtfs/core/gtfsKeyUtil';
import { getStopCalls } from '@/services/gtfs/core/stopTimeWindow';
import { fallbackRouteColor, hexColor } from '@/services/gtfs/core/routeTypeUtil';
import { getActiveServiceKeys } from './activeServices';
import { headsignSql } from './tripHeadsign';
import { terminusOf } from './terminus';

const HOUR_MS = 3_600_000;

export type Departure = {
    timeMs: number;
    routeName: string;
    routeType: number;
    routeColor: string;
    routeTextColor: string;
    /** Where the trip is heading: its headsign when the feed has one, otherwise the name of its last stop. */
    terminus: string;
    /** Which trip this is and where it calls at the stop, to look up its other stops. */
    tripPk: number;
    stopSequence: number;
    /** When the service day the trip belongs to began, which its stop times count from. */
    dayStartMs: number;
};

type TripRow = {
    trip_pk: number;
    service_id: string;
    agency: number;
    route_short_name: string | null;
    route_long_name: string | null;
    route_type: number;
    route_color: string | null;
    route_text_color: string | null;
    terminus: string | null;
    terminus_stop_pk: number;
    terminus_sequence: number;
    headsign: string | null;
};

/** GTFS times count from noon minus 12 hours, which is not midnight on a daylight saving day. */
export function serviceDayStartMs(day: Date): number {
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12).getTime() - 12 * HOUR_MS;
}

/**
 * Scheduled departures from one stop between `from` and `from + windowMs`, soonest first.
 * Trips that end at the stop are left out, since nobody can board them there: that is a row at the pattern's last
 * stop with the last sequence. The check reads the pattern, not the trip's other calls, which are not indexed by trip.
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
    const headsign = await headsignSql(db);

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

        const calls = await getStopCalls(db, stopPk, fromSec, toSec);
        if (calls.length === 0) continue;

        const trips = await db.getAllAsync<TripRow>(
            `SELECT t.trip_pk, t.service_id, t.agency,
                    r.route_short_name, r.route_long_name, r.route_type,
                    r.route_color, r.route_text_color,
                    term.stop_name AS terminus, ps.stop_pk AS terminus_stop_pk, ps.stop_sequence AS terminus_sequence,
                    ${headsign} AS headsign
             FROM trips t
             JOIN patterns p ON p.pattern_pk = t.pattern_pk
             JOIN routes r ON r.route_id = p.route_id AND r.agency = p.agency
             JOIN pattern_stops ps ON ps.pattern_pk = p.pattern_pk
              AND ps.stop_sequence = (SELECT MAX(stop_sequence) FROM pattern_stops WHERE pattern_pk = p.pattern_pk)
             JOIN stops term ON term.stop_pk = ps.stop_pk
             WHERE t.trip_pk IN (SELECT value FROM json_each(?))
               AND t.service_id IN (SELECT value FROM json_each(?))`,
            [JSON.stringify([...new Set(calls.map(c => c.tripPk))]), JSON.stringify(serviceIds)],
        );
        const tripByPk = new Map(trips.map(t => [t.trip_pk, t]));

        for (const call of calls) {
            const r = tripByPk.get(call.tripPk);
            if (!r) continue;
            // The SQL filter matches service_id alone, so two agencies can share an id.
            if (!services.has(makeKey(r.agency, r.service_id))) continue;
            if (stopPk === r.terminus_stop_pk && call.stopSequence >= r.terminus_sequence) continue;
            const routeName = r.route_short_name || r.route_long_name || '?';
            out.push({
                timeMs: dayStartMs + call.departureSec * 1000,
                routeName,
                routeType: r.route_type,
                routeColor: hexColor(r.route_color, fallbackRouteColor(r.route_type, routeName)),
                routeTextColor: hexColor(r.route_text_color, '#FFFFFF'),
                terminus: terminusOf(r.headsign, r.terminus) ?? '',
                tripPk: call.tripPk,
                stopSequence: call.stopSequence,
                dayStartMs,
            });
        }
    }

    return out.sort((a, b) => a.timeMs - b.timeMs).slice(0, limit);
}
