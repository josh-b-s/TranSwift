import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

/** Live speed in m/s from GPS, or null until a valid reading arrives. Only watches while `active`. */
export function useCurrentSpeedMps(active: boolean): number | null {
    const [speed, setSpeed] = useState<number | null>(null);

    useEffect(() => {
        if (!active) return;

        let cancelled = false;
        let subscription: Location.LocationSubscription | undefined;

        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted' || cancelled) return;

            const sub = await Location.watchPositionAsync(
                { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 0 },
                ({ coords }) => setSpeed(coords.speed != null && coords.speed >= 0 ? coords.speed : null),
            );
            // The effect may have been cleaned up while the watch was starting.
            if (cancelled) sub.remove();
            else subscription = sub;
        })();

        return () => {
            cancelled = true;
            subscription?.remove();
        };
    }, [active]);

    return speed;
}
