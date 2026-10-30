import type { TripStopRealtime } from '@mapapp/gtfs-router-rust';
import { whenEngineWarm } from '@/services/gtfs/router/gtfsRouterNative';
import type { AddedDeparture } from '@/services/gtfs/departures/addedDepartures';
import type { StopRealtime } from '@/services/gtfs/departures/liveDepartures';
import { refreshRealtime, serviceMidnightMs } from './gtfsRealtime';

export type TripStopRef = { tripPk: number; stopSequence: number };

/**
 * Refreshes the realtime overlay (no-op without feed URLs, and at most every 30 s) and reads the status of the
 * given trip stops from it. Waits for a warm-up that is already running. Empty when none is, which leaves the
 * caller on scheduled times.
 */
export async function fetchStopRealtime(refs: TripStopRef[]): Promise<StopRealtime[]> {
    const engine = await whenEngineWarm();
    if (!engine || refs.length === 0) return [];
    await refreshRealtime(engine);
    const query = refs.map(({ tripPk, stopSequence }) => ({ tripPk, stopSequence }));
    return engine.tripRealtime(query).map((r: TripStopRealtime) => ({
        tripPk: r.tripPk,
        stopSequence: r.stopSequence,
        cancelled: r.cancelled,
        skipped: r.skipped,
        delaySec: r.departureDelaySec ?? null,
        arrivalDelaySec: r.arrivalDelaySec ?? null,
    }));
}

/**
 * The added and replacement trips that leave a stop: ones only the realtime feeds know of, which the timetable
 * cannot list. Same refresh and warm-up rules as `fetchStopRealtime`.
 */
export async function fetchAddedDepartures(stopPk: number): Promise<AddedDeparture[]> {
    const engine = await whenEngineWarm();
    if (!engine) return [];
    await refreshRealtime(engine);
    const midnightMs = serviceMidnightMs();
    return engine.addedDepartures(stopPk).map(a => ({
        routeId: a.routeId ?? null,
        agency: a.agency,
        timeMs: midnightMs + a.departureSec * 1000,
        lastStopPk: a.lastStopPk,
    }));
}
