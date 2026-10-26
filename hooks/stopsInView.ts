import { useEffect, useMemo, useState } from 'react';
import type { Region } from 'react-native-maps';
import { onActiveDbChange } from '@/services/db/activeDbChange';
import { getDb, isDbReady } from '@/services/db/sqliteDb';
import { getAllStopsCached, type RepoStop } from '@/services/gtfs/core/stopRepo';
import { stopsInRegion } from '@/services/gtfs/departures/stopsInRegion';

const NO_STOPS: RepoStop[] = [];

/** The stops to draw for the visible map area. Reloads when `enabled` flips or the active database changes. */
export function useStopsInView(region: Region | null, enabled: boolean): RepoStop[] {
    const [allStops, setAllStops] = useState<RepoStop[]>(NO_STOPS);
    // The saved database is restored after the map mounts, so the first load can find none.
    const [dbVersion, setDbVersion] = useState(0);
    useEffect(() => onActiveDbChange(() => setDbVersion(v => v + 1)), []);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        (async () => {
            const stops = (await isDbReady()) ? await getAllStopsCached(await getDb()) : NO_STOPS;
            if (!cancelled) setAllStops(stops);
        })();
        return () => {
            cancelled = true;
        };
    }, [enabled, dbVersion]);

    return useMemo(
        () => (enabled && region ? stopsInRegion(allStops, region) : NO_STOPS),
        [allStops, region, enabled],
    );
}
