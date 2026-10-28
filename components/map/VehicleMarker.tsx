import React, { memo, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import type { MapVehicle } from '@/services/gtfs/vehicles/vehicleRoutes';
import { bearingBucket, pointerOffset } from '@/services/gtfs/vehicles/vehicleBearing';

const SIZE = 40;
const BADGE = 26;
const DOT = 9;

// A marker's view is drawn to a picture once and reused, so redrawing is only switched on while it changes.
const SNAPSHOT_MS = 400;

/** A route badge in the route's colour, with a dot on the side the vehicle is heading. */
export default memo(function VehicleMarker({ vehicle }: { vehicle: MapVehicle }) {
    const bearing = bearingBucket(vehicle.bearing);
    const [tracking, setTracking] = useState(true);

    useEffect(() => {
        setTracking(true);
        const timer = setTimeout(() => setTracking(false), SNAPSHOT_MS);
        return () => clearTimeout(timer);
    }, [vehicle.routeName, vehicle.color, vehicle.textColor, bearing]);

    const dot = bearing === null ? null : pointerOffset(bearing, (BADGE + DOT) / 2 - 1);

    return (
        <Marker
            coordinate={{ latitude: vehicle.latitude, longitude: vehicle.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={tracking}
            zIndex={5}
            accessibilityLabel={`${vehicle.routeName}${vehicle.label ? `, ${vehicle.label}` : ''}`}
        >
            <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
                <View
                    style={{
                        width: BADGE, height: BADGE, borderRadius: BADGE / 2, backgroundColor: vehicle.color,
                        borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: vehicle.textColor, fontSize: 10, fontWeight: '800', paddingHorizontal: 1 }}>
                        {vehicle.routeName}
                    </Text>
                </View>
                {dot && (
                    <View
                        style={{
                            position: 'absolute', width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: '#FFFFFF',
                            borderWidth: 2, borderColor: vehicle.color,
                            left: SIZE / 2 - DOT / 2 + dot.x, top: SIZE / 2 - DOT / 2 + dot.y,
                        }}
                    />
                )}
            </View>
        </Marker>
    );
});
