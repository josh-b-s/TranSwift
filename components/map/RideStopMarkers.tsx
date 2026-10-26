import { Polyline } from 'react-native-maps';
import type { RouteSegment, RouteStop } from '@/services/gtfs/router/routeTypes';

/** Width of a ride's line on the map. The stop dots use the same width so each reads as a bead on it. */
export const RIDE_LINE_WIDTH = 7;
// Half-length of the line each dot is drawn as (about 1 m). Much shorter and the map rounds it away,
// so some stops get no dot.
export const HALF_LENGTH_DEG = 1e-5;

/**
 * A white dot at each stop a ride passes, one native line per stop. The dots are round-capped
 * zero-length lines, which the map draws centred on the stop at any rotation, unlike view markers
 * whose anchor drifts on Android. Tapping a dot reports the stop so the caller can show its departures.
 */
export function RideStopMarkers({ segment, onSelect }: { segment: RouteSegment; onSelect: (stop: RouteStop) => void }) {
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
                    onPress={() => onSelect(stop)}
                />
            ))}
        </>
    );
}
