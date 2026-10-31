import React, { memo, useEffect, useState } from 'react';
import { Marker } from 'react-native-maps';
import PlacePin from '@/components/map/PlacePin';

// A marker's view is drawn to a picture once and reused, so redrawing is only switched on while it changes.
const SNAPSHOT_MS = 400;

/** The start or destination of the route, as a pin in the given colour with its tip on the place. */
export default memo(function PlaceMarker({ latitude, longitude, color, title }: {
    latitude: number;
    longitude: number;
    color: string;
    title: string;
}) {
    const [tracking, setTracking] = useState(true);

    useEffect(() => {
        setTracking(true);
        const timer = setTimeout(() => setTracking(false), SNAPSHOT_MS);
        return () => clearTimeout(timer);
    }, [color]);

    return (
        <Marker
            coordinate={{ latitude, longitude }}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={tracking}
            zIndex={8}
            title={title}
        >
            <PlacePin color={color} />
        </Marker>
    );
});
