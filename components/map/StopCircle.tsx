import { useMemo } from 'react';
import { Circle } from 'react-native-maps';

// Circle's stroke is a fixed number of pixels at every zoom, while its radius is in metres. A radius this small
// leaves just the stroke, so the dot keeps one on-screen size without being redrawn as the map zooms.
const RADIUS_M = 0.25;
const RING_WIDTH = 12;
const CENTRE_WIDTH = RING_WIDTH - 6;

/**
 * A white centre in a ring of the given colour. Circles are not tappable in react-native-maps, so taps are found
 * from the map's own press event (see nearestPoint.ts).
 */
export function StopCircle({ latitude, longitude, color }: { latitude: number; longitude: number; color: string }) {
    const center = useMemo(() => ({ latitude, longitude }), [latitude, longitude]);

    return (
        <>
            <Circle center={center} radius={RADIUS_M} strokeColor={color} strokeWidth={RING_WIDTH} fillColor="transparent" zIndex={1} />
            <Circle center={center} radius={RADIUS_M} strokeColor="#ffffff" strokeWidth={CENTRE_WIDTH} fillColor="transparent" zIndex={2} />
        </>
    );
}
