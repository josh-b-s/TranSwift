import { useEffect, useState } from 'react';
import { getDb } from '@/services/db/sqliteDb';
import { loadTripPath, type TripPath, type TripRef } from '@/services/gtfs/vehicles/tripPath';

/** A trip the map is showing the line of, and the colour to draw it in. */
export type TripFocus = { trip: TripRef; color: string };

/** The line and stops of one trip, or null while none is wanted, it loads, or the timetable lacks it. */
export function useTripPath(trip: TripRef | null): TripPath | null {
    const [path, setPath] = useState<TripPath | null>(null);
    // Callers may rebuild the ref on every render, so restart only when the trip itself changes.
    const tripKey = trip === null ? null : 'tripPk' in trip ? `pk:${trip.tripPk}` : `id:${trip.tripId}`;

    useEffect(() => {
        setPath(null);
        if (!trip) return;
        let cancelled = false;
        getDb()
            .then(db => loadTripPath(db, trip))
            .then(loaded => { if (!cancelled) setPath(loaded); })
            .catch(err => console.warn('[tripPath] failed, showing no line:', err));
        return () => {
            cancelled = true;
        };
    }, [tripKey]);

    return path;
}
