import { useEffect, useMemo, useState } from 'react';
import { getDb } from '@/services/db/sqliteDb';
import type { Departure } from '@/services/gtfs/departures/stopDepartures';
import { vehicleDeparture } from '@/services/gtfs/vehicles/vehicleDeparture';
import type { MapVehicle } from '@/services/gtfs/vehicles/vehicleRoutes';

type State = { tripId: string | null; departure: Departure | null; loading: boolean };

/**
 * The vehicle's trip as a departure from the stop it is heading to, so its stops can be listed. Looked up again
 * whenever the vehicle moves on to another stop. `loading` is true until the first lookup for a trip finishes.
 */
export function useVehicleDeparture(vehicle: MapVehicle | null, terminus: string | null): { departure: Departure | null; loading: boolean } {
    const tripId = vehicle?.tripId ?? null;
    const stopSequence = vehicle?.currentStopSequence ?? null;
    const [state, setState] = useState<State>({ tripId: null, departure: null, loading: false });

    useEffect(() => {
        if (!vehicle || !tripId) return;
        let cancelled = false;
        // Another trip's stops must not show while this one loads.
        setState(s => ({ tripId, departure: s.tripId === tripId ? s.departure : null, loading: s.tripId !== tripId }));
        getDb()
            .then(db => vehicleDeparture(db, vehicle, null, new Date()))
            .then(departure => { if (!cancelled) setState({ tripId, departure, loading: false }); })
            .catch(err => {
                console.warn('[vehicleDeparture] could not look up the vehicle trip:', err);
                if (!cancelled) setState({ tripId, departure: null, loading: false });
            });
        return () => { cancelled = true; };
    }, [tripId, stopSequence]);

    const departure = state.tripId === tripId ? state.departure : null;
    // The name is only a label, so it must not make the stops load again.
    const named = useMemo(() => (departure ? { ...departure, terminus: terminus ?? '' } : null), [departure, terminus]);
    return { departure: named, loading: tripId !== null && (state.tripId !== tripId || state.loading) };
}
