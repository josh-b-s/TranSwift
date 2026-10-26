import { memo } from 'react';
import { StopCircle } from '@/components/map/StopCircle';
import type { RouteSegment } from '@/services/gtfs/router/routeTypes';

/** Width of a ride's line on the map. */
export const RIDE_LINE_WIDTH = 7;

/** A circle at each stop a ride passes, in the route's colour. */
export const RideStopMarkers = memo(function RideStopMarkers({ segment, color }: { segment: RouteSegment; color: string }) {
    return (
        <>
            {segment.stops?.map((stop, i) => (
                <StopCircle key={i} latitude={stop.latitude} longitude={stop.longitude} color={color} />
            ))}
        </>
    );
});
