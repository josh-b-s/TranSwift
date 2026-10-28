import { useEffect, useState } from 'react';
import { getDb } from '@/services/db/sqliteDb';
import type { RepoStop } from '@/services/gtfs/core/stopRepo';
import { loadStationDetail, type StationResult } from '@/services/gtfs/station/stationQueries';

/** Station detail for a stop, or null until it has loaded. A failed load is logged and treated as no detail. */
export function useStationDetail(stop: RepoStop | null): StationResult | null {
    const [result, setResult] = useState<StationResult | null>(null);

    useEffect(() => {
        setResult(null);
        if (!stop) return;
        let cancelled = false;
        getDb()
            .then(db => loadStationDetail(db, stop.stop_pk))
            .then(r => !cancelled && setResult(r))
            .catch(err => {
                console.warn('[stationDetail] could not load:', err);
                if (!cancelled) setResult({ status: 'none' });
            });
        return () => {
            cancelled = true;
        };
    }, [stop]);

    return result;
}
