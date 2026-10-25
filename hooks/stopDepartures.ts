import { useEffect, useState } from 'react';
import { getDb } from '@/services/db/sqliteDb';
import type { RepoStop } from '@/services/gtfs/core/stopRepo';
import { type Departure, getStopDepartures } from '@/services/gtfs/departures/stopDepartures';

const WINDOW_MS = 3 * 3_600_000;
const MAX_DEPARTURES = 40;
const REFRESH_MS = 60_000;

type State = { departures: Departure[]; loading: boolean; error: string | null };

/** Upcoming departures for a stop, reloaded every minute so the list drops trips that have left. */
export function useStopDepartures(stop: RepoStop | null): State {
    const [state, setState] = useState<State>({ departures: [], loading: false, error: null });

    useEffect(() => {
        if (!stop) return;
        let cancelled = false;

        const load = async () => {
            try {
                const departures = await getStopDepartures(await getDb(), stop.stop_pk, new Date(), WINDOW_MS, MAX_DEPARTURES);
                if (!cancelled) setState({ departures, loading: false, error: null });
            } catch (e) {
                if (!cancelled) setState({ departures: [], loading: false, error: e instanceof Error ? e.message : String(e) });
            }
        };

        setState({ departures: [], loading: true, error: null });
        load();
        const timer = setInterval(load, REFRESH_MS);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [stop]);

    return state;
}
