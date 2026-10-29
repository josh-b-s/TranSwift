import { useEffect, useState } from 'react';
import { getDb } from '@/services/db/sqliteDb';
import type { Departure } from '@/services/gtfs/departures/stopDepartures';
import { loadStopsAway } from '@/services/gtfs/departures/stopsAway';
import { fetchVehicleFixes } from '@/services/gtfs/realtime/vehiclePositions';
import { freshVehicles } from '@/services/gtfs/vehicles/vehicleFix';

const REFRESH_MS = 20_000;
const NONE: ReadonlyMap<number, number> = new Map();

/**
 * For each listed trip whose vehicle is being tracked, how many stops it still has to reach before the stop,
 * refreshed every 20 seconds while `enabled`. Empty when the feed has no VehiclePositions URLs. A failed
 * refresh is logged and the last counts stay.
 */
export function useStopsAway(departures: Departure[], enabled: boolean): ReadonlyMap<number, number> {
    const [away, setAway] = useState(NONE);
    // The list is rebuilt every minute, so restart only when the trips in it change.
    const tripsId = departures.map(d => `${d.tripPk}:${d.stopSequence}`).join(',');

    useEffect(() => {
        if (!enabled || tripsId === '') {
            setAway(NONE);
            return;
        }
        let cancelled = false;

        const refresh = async () => {
            try {
                const fixes = freshVehicles(await fetchVehicleFixes(), Date.now());
                const result = await loadStopsAway(await getDb(), departures, fixes);
                if (!cancelled) setAway(result.size > 0 ? result : NONE);
            } catch (err) {
                console.warn('[stopsAway] refresh failed, keeping the last counts:', err);
            }
        };

        refresh();
        const timer = setInterval(refresh, REFRESH_MS);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [tripsId, enabled]);

    return away;
}
