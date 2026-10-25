import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { angleDeltaDeg, normalizeDeg } from '@/services/geo/angle';

export type CompassHeading = { degrees: number; accuracyLevel: number };

// Each reading moves the smoothed heading this fraction of the way to the raw one.
const SMOOTHING = 0.2;
// The marker only turns once the smoothed heading has drifted this far from what it shows.
const MIN_TURN_DEG = 3;

/** Compass heading, degrees clockwise from north, or null until the first reading. Only watches while `active`. */
export function useCompassHeading(active: boolean): CompassHeading | null {
    const [heading, setHeading] = useState<CompassHeading | null>(null);
    const smoothed = useRef<number | null>(null);

    useEffect(() => {
        if (!active) return;

        let cancelled = false;
        let subscription: Location.LocationSubscription | undefined;

        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted' || cancelled) return;

            const sub = await Location.watchHeadingAsync(({ trueHeading, magHeading, accuracy }) => {
                // trueHeading is -1 until the OS has a location fix to correct for declination.
                const raw = trueHeading >= 0 ? trueHeading : magHeading;
                const previous = smoothed.current;
                const next = previous === null ? raw : normalizeDeg(previous + angleDeltaDeg(previous, raw) * SMOOTHING);
                smoothed.current = next;

                setHeading(shown => {
                    const turned = shown === null || Math.abs(angleDeltaDeg(shown.degrees, next)) >= MIN_TURN_DEG;
                    if (!turned && shown.accuracyLevel === accuracy) return shown;
                    return { degrees: turned ? next : shown.degrees, accuracyLevel: accuracy };
                });
            });
            // The effect may have been cleaned up while the watch was starting.
            if (cancelled) sub.remove();
            else subscription = sub;
        })();

        return () => {
            cancelled = true;
            subscription?.remove();
        };
    }, [active]);

    return heading;
}
