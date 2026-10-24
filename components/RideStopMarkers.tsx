import { type ElementRef, useEffect, useRef, useState } from 'react';
import { Marker, Polyline } from 'react-native-maps';
import type { RouteSegment, RouteStop } from '@/services/gtfs/router/raptorRouter';

/** Width of a ride's line on the map. The stop dots use the same width so each reads as a bead on it. */
export const RIDE_LINE_WIDTH = 7;
// Half-length of the line each dot is drawn as (about 1 m). Much shorter and the map rounds it away,
// so some stops get no dot.
const HALF_LENGTH_DEG = 1e-5;

/**
 * A white dot at each stop a ride passes, one native line per stop. The dots are round-capped
 * zero-length lines, which the map draws centred on the stop at any rotation, unlike view markers
 * whose anchor drifts on Android. Tapping a dot puts the one shared marker on it to show its name.
 */
export function RideStopMarkers({ segment }: { segment: RouteSegment }) {
    const [selected, setSelected] = useState<RouteStop | null>(null);
    const markerRef = useRef<ElementRef<typeof Marker>>(null);

    useEffect(() => setSelected(null), [segment]);
    useEffect(() => {
        if (!selected) return;
        // The marker has to be on the map before its callout can open.
        const frame = requestAnimationFrame(() => markerRef.current?.showCallout());
        return () => cancelAnimationFrame(frame);
    }, [selected]);

    return (
        <>
            {segment.stops?.map((stop, i) => (
                <Polyline
                    key={i}
                    coordinates={[
                        { latitude: stop.latitude - HALF_LENGTH_DEG, longitude: stop.longitude },
                        { latitude: stop.latitude + HALF_LENGTH_DEG, longitude: stop.longitude },
                    ]}
                    strokeColor="#ffffff"
                    strokeWidth={RIDE_LINE_WIDTH}
                    lineCap="round"
                    tappable
                    onPress={() => setSelected(stop)}
                />
            ))}
            {selected && <Marker ref={markerRef} coordinate={selected} title={selected.name} />}
        </>
    );
}
