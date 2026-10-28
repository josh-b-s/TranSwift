import { useEffect, useState } from 'react';
import { getDb } from '@/services/db/sqliteDb';
import type { Departure } from '@/services/gtfs/departures/stopDepartures';
import { getTripStops } from '@/services/gtfs/departures/tripStops';
import { applyLiveToStops, type LiveTripStop } from '@/services/gtfs/departures/liveDepartures';
import { fetchStopRealtime } from '@/services/gtfs/realtime/departureRealtime';

type State = { stops: LiveTripStop[]; loading: boolean; error: string | null };

/** The stops of one departure's trip, scheduled first and then with realtime delays when the feeds have them. */
export function useTripStops(departure: Departure | null): State {
    const [state, setState] = useState<State>({ stops: [], loading: false, error: null });

    // The departures list is rebuilt every minute, so depend on what identifies the trip, not the object.
    const tripPk = departure?.tripPk;
    const stopSequence = departure?.stopSequence;
    const timeMs = departure?.timeMs;
    const dayStartMs = departure?.dayStartMs;

    useEffect(() => {
        if (!departure) return;
        let cancelled = false;
        setState({ stops: [], loading: true, error: null });

        (async () => {
            const scheduled = await getTripStops(await getDb(), departure);
            const plain = applyLiveToStops(scheduled, departure.tripPk, []);
            if (cancelled) return;
            setState({ stops: plain, loading: false, error: null });

            const statuses = await fetchStopRealtime(scheduled.map(s => ({ tripPk: departure.tripPk, stopSequence: s.stopSequence })))
                .catch(err => {
                    console.warn('[tripStops] realtime unavailable, showing scheduled times:', err);
                    return [];
                });
            if (!cancelled) setState({ stops: applyLiveToStops(scheduled, departure.tripPk, statuses), loading: false, error: null });
        })().catch(e => !cancelled && setState({ stops: [], loading: false, error: e instanceof Error ? e.message : String(e) }));

        return () => {
            cancelled = true;
        };
    }, [tripPk, stopSequence, timeMs, dayStartMs]);

    return state;
}
