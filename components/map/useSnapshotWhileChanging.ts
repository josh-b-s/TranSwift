import { useEffect, useState } from 'react';

// A marker's view is drawn to a picture once and reused, so redrawing is only switched on while it changes.
const SNAPSHOT_MS = 400;

/** True for a moment after any of `deps` changes, which is how long a marker's view needs to be redrawn. */
export function useSnapshotWhileChanging(deps: readonly unknown[]): boolean {
    const [tracking, setTracking] = useState(true);

    useEffect(() => {
        setTracking(true);
        const timer = setTimeout(() => setTracking(false), SNAPSHOT_MS);
        return () => clearTimeout(timer);
    }, deps);

    return tracking;
}
