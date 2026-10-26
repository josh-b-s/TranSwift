import { useEffect, useMemo, useState } from 'react';
import { getDb } from '@/services/db/sqliteDb';
import type { RepoStop } from '@/services/gtfs/core/stopRepo';
import { cachedStopColors, loadStopColors } from '@/services/gtfs/departures/stopColors';

/** Route colours for the stops on screen, by stop_pk. Stops show without one until it loads. */
export function useStopColors(stops: RepoStop[]): Map<number, string> {
    // Bumped when a load finishes; the colours themselves are read from the cache, so a slow load for an old view
    // can never overwrite a newer one.
    const [loaded, setLoaded] = useState(0);

    useEffect(() => {
        if (stops.length === 0) return;
        (async () => {
            await loadStopColors(await getDb(), stops.map(s => s.stop_pk));
            setLoaded(n => n + 1);
        })();
    }, [stops]);

    return useMemo(() => cachedStopColors(stops.map(s => s.stop_pk)), [stops, loaded]);
}
