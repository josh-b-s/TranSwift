import { useEffect, useState } from 'react';
import { getDb } from '@/services/db/sqliteDb';
import type { RepoStop } from '@/services/gtfs/core/stopRepo';
import { getStopDepartures } from '@/services/gtfs/departures/stopDepartures';
import { applyLiveStatus, hasLiveData, type LiveDeparture } from '@/services/gtfs/departures/liveDepartures';
import { fetchStopRealtime } from '@/services/gtfs/realtime/departureRealtime';

const WINDOW_MS = 3 * 3_600_000;
const MAX_DEPARTURES = 40;
const REFRESH_MS = 60_000;
// A trip scheduled a little ago can still be ahead if it is running late, so the query reaches back this far.
const LATE_LOOKBACK_MS = 15 * 60_000;
// Extra rows for the lookback, so late trips do not push later ones out of the limit.
const LOOKBACK_ROWS = 20;

type State = { departures: LiveDeparture[]; loading: boolean; error: string | null; live: boolean };

const EMPTY: State = { departures: [], loading: false, error: null, live: false };

/**
 * Upcoming departures for a stop, reloaded every minute. Scheduled times show at once, then realtime delays and
 * cancellations are applied when the feeds have them.
 */
export function useStopDepartures(stop: RepoStop | null): State {
    const [state, setState] = useState<State>(EMPTY);

    useEffect(() => {
        if (!stop) return;
        let cancelled = false;

        const load = async (showScheduledFirst: boolean) => {
            try {
                const started = Date.now();
                const scheduled = await getStopDepartures(
                    await getDb(),
                    stop.stop_pk,
                    new Date(started - LATE_LOOKBACK_MS),
                    WINDOW_MS + LATE_LOOKBACK_MS,
                    MAX_DEPARTURES + LOOKBACK_ROWS,
                );
                console.log(`[stopDepartures] stop ${stop.stop_pk}: ${scheduled.length} rows in ${Date.now() - started} ms`);
                if (showScheduledFirst && !cancelled) {
                    const departures = applyLiveStatus(scheduled, [], Date.now()).slice(0, MAX_DEPARTURES);
                    setState({ departures, loading: false, error: null, live: false });
                }

                const statuses = await fetchStopRealtime(scheduled).catch(err => {
                    console.warn('[stopDepartures] realtime unavailable, showing scheduled times:', err);
                    return [];
                });
                if (cancelled) return;
                const departures = applyLiveStatus(scheduled, statuses, Date.now()).slice(0, MAX_DEPARTURES);
                setState({ departures, loading: false, error: null, live: hasLiveData(departures) });
            } catch (e) {
                if (!cancelled) setState({ ...EMPTY, error: e instanceof Error ? e.message : String(e) });
            }
        };

        setState({ ...EMPTY, loading: true });
        load(true);
        const timer = setInterval(() => load(false), REFRESH_MS);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [stop]);

    return state;
}
