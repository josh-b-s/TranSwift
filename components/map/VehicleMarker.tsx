import React, { memo, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import Svg, { Circle, G, Polygon } from 'react-native-svg';
import type { MapVehicle } from '@/services/gtfs/vehicles/vehicleRoutes';
import { bearingBucket } from '@/services/gtfs/vehicles/vehicleBearing';
import { badgeText } from '@/services/gtfs/vehicles/badgeText';

// The drawing is centred in a square this big. The arrow tip is the farthest point, 24 from the centre, and with the
// selected scale it is 29, still inside half the square, so no heading gets cut off.
const SIZE = 64;
const CENTER = SIZE / 2;
const DISC_R = 11;
const RING_R = DISC_R + 2;
const HALO_R = 20;
const SELECTED_SCALE = 1.2;
// A selected marker is drawn on a canvas this much taller above and below, and wider, so the name label fits under the
// badge while the badge stays at the middle, where the marker is anchored.
const LABEL_H = 20;
const LABEL_CANVAS_W = 128;
// Points up. Its base sits inside the disc, so the disc covers it and the tip looks like it grows out of the badge.
const ARROW = `${CENTER - 8},${CENTER - 8} ${CENTER + 8},${CENTER - 8} ${CENTER},${CENTER - 20}`;

// A marker's view is drawn to a picture once and reused, so redrawing is only switched on while it changes.
const SNAPSHOT_MS = 400;

function Arrow({ bearing, fill, outline }: { bearing: number; fill: string; outline: number }) {
    return (
        <G rotation={bearing} originX={CENTER} originY={CENTER}>
            <Polygon points={ARROW} fill={fill} stroke={fill} strokeWidth={outline} strokeLinejoin="round" />
        </G>
    );
}

type Props = { vehicle: MapVehicle; selected: boolean; onPress: (vehicle: MapVehicle) => void };

/**
 * A route badge in the route's colour with an arrow growing out of the side the vehicle is heading. Selected, it is
 * larger, has a halo and shows the full route name under it.
 */
export default memo(function VehicleMarker({ vehicle, selected, onPress }: Props) {
    const bearing = bearingBucket(vehicle.bearing);
    const [tracking, setTracking] = useState(true);

    useEffect(() => {
        setTracking(true);
        const timer = setTimeout(() => setTracking(false), SNAPSHOT_MS);
        return () => clearTimeout(timer);
    }, [vehicle.routeName, vehicle.color, vehicle.textColor, bearing, selected]);

    const scale = selected ? SELECTED_SCALE : 1;

    return (
        <Marker
            coordinate={{ latitude: vehicle.latitude, longitude: vehicle.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={tracking}
            zIndex={selected ? 10 : 5}
            onPress={() => onPress(vehicle)}
            accessibilityLabel={`${vehicle.routeName}${vehicle.label ? `, ${vehicle.label}` : ''}`}
        >
            <View
                style={{
                    width: selected ? LABEL_CANVAS_W : SIZE, height: selected ? SIZE + 2 * LABEL_H : SIZE,
                    alignItems: 'center', justifyContent: 'center',
                }}
            >
                <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
                    <G scale={scale} originX={CENTER} originY={CENTER}>
                        {selected && <Circle cx={CENTER} cy={CENTER} r={HALO_R} fill={vehicle.color} fillOpacity={0.3} />}
                        {bearing !== null && <Arrow bearing={bearing} fill="#FFFFFF" outline={8} />}
                        <Circle cx={CENTER} cy={CENTER} r={RING_R} fill="#FFFFFF" />
                        {bearing !== null && <Arrow bearing={bearing} fill={vehicle.color} outline={4} />}
                        <Circle cx={CENTER} cy={CENTER} r={DISC_R} fill={vehicle.color} />
                    </G>
                </Svg>
                <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={{ width: DISC_R * 2 * scale - 2, textAlign: 'center', color: vehicle.textColor, fontSize: 10 * scale, fontWeight: '800' }}
                >
                    {badgeText(vehicle.routeName)}
                </Text>
                {selected && (
                    <View
                        style={{
                            position: 'absolute', bottom: 0, maxWidth: LABEL_CANVAS_W, paddingHorizontal: 7, paddingVertical: 2,
                            borderRadius: 999, backgroundColor: vehicle.color, borderWidth: 2, borderColor: '#FFFFFF',
                        }}
                    >
                        <Text numberOfLines={1} style={{ color: vehicle.textColor, fontSize: 11, fontWeight: '800' }}>
                            {vehicle.routeName}
                        </Text>
                    </View>
                )}
            </View>
        </Marker>
    );
});
