import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { LatLng } from 'react-native-maps';

export type UserPosition = LatLng & { accuracyM: number | null };

/** Live device position, or null until the first fix. Only watches while `active`. */
export function useUserPosition(active: boolean): UserPosition | null {
    const [position, setPosition] = useState<UserPosition | null>(null);

    useEffect(() => {
        if (!active) return;

        let cancelled = false;
        let subscription: Location.LocationSubscription | undefined;

        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted' || cancelled) return;

            const sub = await Location.watchPositionAsync(
                { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 1 },
                ({ coords }) =>
                    setPosition({ latitude: coords.latitude, longitude: coords.longitude, accuracyM: coords.accuracy }),
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

    return position;
}
