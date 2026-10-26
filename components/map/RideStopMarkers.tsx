import { memo } from 'react';
import { StopCircle } from '@/components/map/StopCircle';
import type { RouteSegment, RouteStop } from '@/services/gtfs/router/routeTypes';

/** Width of a ride's line on the map. */
export const RIDE_LINE_WIDTH = 7;

/** A circle at each stop a ride passes, in the route's colour. Tapping one reports the stop so the caller can show its departures. */
export const RideStopMarkers = memo(function RideStopMarkers({ segment, color, halfLength, onSelect }: {
    segment: RouteSegment;
    color: string;
    halfLength: number;
    onSelect: (stop: RouteStop) => void;
}) {
    return (
        <>
            {segment.stops?.map((stop, i) => (
                <StopCircle key={i} latitude={stop.latitude} longitude={stop.longitude} color={color} halfLength={halfLength} onPress={() => onSelect(stop)} />
            ))}
        </>
    );
});
