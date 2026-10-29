import type { Departure } from './stopDepartures';
import type { TripStop } from './tripStops';

/** What the realtime feeds say about one stop of one trip. `delaySec` is null when they have nothing for it. */
export type StopRealtime = {
    tripPk: number;
    stopSequence: number;
    cancelled: boolean;
    skipped: boolean;
    /** Seconds late leaving this stop. */
    delaySec: number | null;
    /** Seconds late arriving at this stop. Feeds can report it differently from the departure. */
    arrivalDelaySec: number | null;
};

export type LiveDeparture = Departure & {
    /** The scheduled time moved by the delay. Equal to `timeMs` when there is no delay data. */
    liveTimeMs: number;
    delaySec: number | null;
    cancelled: boolean;
    /** The vehicle will not stop here. */
    skipped: boolean;
};

export const realtimeKey = (tripPk: number, stopSequence: number) => `${tripPk}:${stopSequence}`;

export const indexRealtime = (statuses: StopRealtime[]) =>
    new Map(statuses.map(s => [realtimeKey(s.tripPk, s.stopSequence), s]));

export const liveTime = (timeMs: number, delaySec: number | null) => timeMs + (delaySec ?? 0) * 1000;

/**
 * Puts realtime status on scheduled departures, in order of live time. A delayed trip can leave after a later
 * one, and one scheduled just before `nowMs` can still be ahead, so callers fetch some scheduled history and this
 * drops whatever has really gone. A cancelled trip is kept only while its scheduled time is ahead.
 */
export function applyLiveStatus(departures: Departure[], statuses: StopRealtime[], nowMs: number): LiveDeparture[] {
    const byKey = indexRealtime(statuses);
    return departures
        .map((d): LiveDeparture => {
            const status = byKey.get(realtimeKey(d.tripPk, d.stopSequence));
            const delaySec = status?.delaySec ?? null;
            return {
                ...d,
                liveTimeMs: liveTime(d.timeMs, delaySec),
                delaySec,
                cancelled: status?.cancelled ?? false,
                skipped: status?.skipped ?? false,
            };
        })
        .filter(d => (d.cancelled ? d.timeMs : d.liveTimeMs) >= nowMs)
        .sort((a, b) => a.liveTimeMs - b.liveTimeMs);
}

/** True when any departure carries live data, so the sheet can say its times are not only scheduled. */
export const hasLiveData = (departures: LiveDeparture[]) => departures.some(d => d.delaySec !== null || d.cancelled);

export type LiveTripStop = TripStop & { liveTimeMs: number; delaySec: number | null; skipped: boolean };

/**
 * Live times for the stops of one trip. The first stop's time is a departure and the rest are arrivals, so each
 * takes the matching delay from the engine.
 */
export function applyLiveToStops(stops: TripStop[], tripPk: number, statuses: StopRealtime[]): LiveTripStop[] {
    const byKey = indexRealtime(statuses);
    return stops.map((stop, i) => {
        const status = byKey.get(realtimeKey(tripPk, stop.stopSequence));
        const delaySec = (i === 0 ? status?.delaySec : status?.arrivalDelaySec) ?? null;
        return { ...stop, liveTimeMs: liveTime(stop.timeMs, delaySec), delaySec, skipped: status?.skipped ?? false };
    });
}
