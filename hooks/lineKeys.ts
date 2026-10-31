import { useEffect, useState } from 'react';
import { getDb } from '@/services/db/sqliteDb';
import { loadLineKeys } from '@/services/gtfs/vehicles/lineKeys';

const NONE: ReadonlyMap<string, string> = new Map();

/** The line of each given feed trip id (see `loadLineKeys`). A failed lookup is logged and the last keys stay. */
export function useLineKeys(tripIds: string[]): ReadonlyMap<string, string> {
    const [keys, setKeys] = useState(NONE);
    // The vehicles refresh every 15 seconds, so restart only when the set of trips changes.
    const id = [...tripIds].sort().join('\n');

    useEffect(() => {
        if (id === '') {
            setKeys(NONE);
            return;
        }
        let cancelled = false;
        getDb()
            .then(db => loadLineKeys(db, id.split('\n')))
            .then(loaded => { if (!cancelled) setKeys(loaded); })
            .catch(err => console.warn('[lineKeys] failed, keeping the last lines:', err));
        return () => {
            cancelled = true;
        };
    }, [id]);

    return keys;
}
