import { useEffect, useState } from 'react';
import { getDb } from '@/services/db/sqliteDb';
import type { Departure } from '@/services/gtfs/departures/stopDepartures';
import { loadStopsAway } from '@/services/gtfs/departures/stopsAway';
import type { VehicleFix } from '@/services/gtfs/vehicles/vehicleFix';

const NONE: ReadonlyMap<number, number> = new Map();

/**
 * For each listed trip whose vehicle is being tracked, how many stops it still has to reach before the stop.
 * Takes the vehicles the map already fetches, so it costs no requests of its own and follows their refresh.
 * A failure is logged and the last counts stay.
 */
export function useStopsAway(departures: Departure[], vehicles: VehicleFix[]): ReadonlyMap<number, number> {
    const [away, setAway] = useState(NONE);
    // The list is rebuilt every minute, so restart only when the trips in it change.
    const tripsId = departures.map(d => `${d.tripPk}:${d.stopSequence}`).join(',');

    useEffect(() => {
        if (tripsId === '' || vehicles.length === 0) {
            setAway(NONE);
            return;
        }
        let cancelled = false;
        getDb()
            .then(db => loadStopsAway(db, departures, vehicles))
            .then(result => { if (!cancelled) setAway(result.size > 0 ? result : NONE); })
            .catch(err => console.warn('[stopsAway] failed, keeping the last counts:', err));
        return () => {
            cancelled = true;
        };
    }, [tripsId, vehicles]);

    return away;
}
