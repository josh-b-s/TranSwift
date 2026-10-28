import type { TripStopRealtime } from '@mapapp/gtfs-router-rust';
import { getWarmNativeEngine } from '@/services/gtfs/router/gtfsRouterNative';
import type { StopRealtime } from '@/services/gtfs/departures/liveDepartures';
import { refreshRealtime } from './gtfsRealtime';

export type TripStopRef = { tripPk: number; stopSequence: number };

/**
 * Refreshes the realtime overlay (no-op without feed URLs, and at most every 30 s) and reads the status of the
 * given trip stops from it. Empty when the engine is not warm yet, which leaves the caller on scheduled times.
 */
export async function fetchStopRealtime(refs: TripStopRef[]): Promise<StopRealtime[]> {
    const engine = getWarmNativeEngine();
    if (!engine || refs.length === 0) return [];
    await refreshRealtime(engine);
    const query = refs.map(({ tripPk, stopSequence }) => ({ tripPk, stopSequence }));
    return engine.tripRealtime(query).map((r: TripStopRealtime) => ({
        tripPk: r.tripPk,
        stopSequence: r.stopSequence,
        cancelled: r.cancelled,
        skipped: r.skipped,
        delaySec: r.departureDelaySec ?? null,
    }));
}
