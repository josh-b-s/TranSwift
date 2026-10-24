import { useEffect, useMemo, useState } from 'react';
import type { Region } from 'react-native-maps';
import { getDb, isDbReady } from '@/services/db/sqliteDb';
import { getAllStopsCached, type RepoStop } from '@/services/gtfs/core/gtfsRepo';
import { stopsInRegion } from '@/services/gtfs/departures/stopsInRegion';

const NO_STOPS: RepoStop[] = [];

/** The stops to draw for the visible map area. Reloads when `enabled` flips, so a feed imported meanwhile is picked up. */
export function useStopsInView(region: Region | null, enabled: boolean): RepoStop[] {
    const [allStops, setAllStops] = useState<RepoStop[]>(NO_STOPS);

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
    }, [enabled]);

    return useMemo(
        () => (enabled && region ? stopsInRegion(allStops, region) : NO_STOPS),
        [allStops, region, enabled],
    );
}
