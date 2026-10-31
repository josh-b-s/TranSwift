import React, { memo } from 'react';
import { Polyline } from 'react-native-maps';
import { StopCircle } from '@/components/map/StopCircle';
import { RIDE_LINE_WIDTH } from '@/components/map/RideStopMarkers';
import type { TripPath } from '@/services/gtfs/vehicles/tripPath';

/** A trip's whole line with a circle on each of its stops, in the route's colour. */
export default memo(function TripPathOverlay({ path, color }: { path: TripPath; color: string }) {
    return (
        <>
            <Polyline coordinates={path.line} strokeWidth={RIDE_LINE_WIDTH} strokeColor={color} lineCap="round" lineJoin="round" geodesic={false} />
            {path.stops.map((stop, i) => (
                <StopCircle key={i} latitude={stop.latitude} longitude={stop.longitude} color={color} />
            ))}
        </>
    );
});
