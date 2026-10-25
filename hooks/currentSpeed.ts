import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { dropWhileSimulating, subscribeSimulatedFixes } from '@/services/debug/locationSimulator';

// A stationary phone indoors reads 0.1 to 0.7 m/s from GPS noise. Walking is about 1.4 m/s.
const NOISE_FLOOR_MPS = 0.7;

/** Live speed in m/s from GPS, or null until a valid reading arrives. Only watches while `active`. */
export function useCurrentSpeedMps(active: boolean): number | null {
    const [speed, setSpeed] = useState<number | null>(null);

    useEffect(() => {
        if (!active) return;

        let cancelled = false;
        let subscription: Location.LocationSubscription | undefined;

        const onFix = ({ coords }: Location.LocationObject) =>
            setSpeed(coords.speed != null && coords.speed >= 0 ? (coords.speed < NOISE_FLOOR_MPS ? 0 : coords.speed) : null);
        const stopSimulated = subscribeSimulatedFixes(fixes => onFix(fixes[fixes.length - 1]));

        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted' || cancelled) return;

            const sub = await Location.watchPositionAsync(
                { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 0 },
                dropWhileSimulating(onFix),
            );
            // The effect may have been cleaned up while the watch was starting.
            if (cancelled) sub.remove();
            else subscription = sub;
        })();

        return () => {
            cancelled = true;
            subscription?.remove();
            stopSimulated();
        };
    }, [active]);

    return speed;
}
