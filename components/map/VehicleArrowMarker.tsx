import React, { memo } from 'react';
import { View } from 'react-native';
import { Marker } from 'react-native-maps';
import Svg, { Circle, G, Polygon } from 'react-native-svg';
import type { MapVehicle } from '@/services/gtfs/vehicles/vehicleRoutes';
import { CENTER, SELECTED_SCALE, SIZE } from '@/components/map/vehicleMarkerSize';
import { useSnapshotWhileChanging } from '@/components/map/useSnapshotWhileChanging';

const HALO_R = 20;
// Points up. Its base sits under the badge, so the tip looks like it grows out of it.
const ARROW = `${CENTER - 8},${CENTER - 8} ${CENTER + 8},${CENTER - 8} ${CENTER},${CENTER - 20}`;

type Props = { vehicle: MapVehicle; bearing: number; selected: boolean; onPress: (vehicle: MapVehicle) => void };

/**
 * The vehicle's heading arrow, with a halo when selected, lying flat on the map. Flat markers are turned from north
 * and tilted with the map, like the user's arrow, so the arrow keeps pointing along the ground.
 */
export default memo(function VehicleArrowMarker({ vehicle, bearing, selected, onPress }: Props) {
    const tracking = useSnapshotWhileChanging([vehicle.color, selected]);

    return (
        <Marker
            coordinate={{ latitude: vehicle.latitude, longitude: vehicle.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            rotation={bearing}
            tracksViewChanges={tracking}
            zIndex={selected ? 9 : 4}
            onPress={() => onPress(vehicle)}
        >
            <View style={{ width: SIZE, height: SIZE }}>
                <Svg width={SIZE} height={SIZE}>
                    <G scale={selected ? SELECTED_SCALE : 1} originX={CENTER} originY={CENTER}>
                        {selected && <Circle cx={CENTER} cy={CENTER} r={HALO_R} fill={vehicle.color} fillOpacity={0.3} />}
                        <Polygon points={ARROW} fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={8} strokeLinejoin="round" />
                        <Polygon points={ARROW} fill={vehicle.color} stroke={vehicle.color} strokeWidth={4} strokeLinejoin="round" />
                    </G>
                </Svg>
            </View>
        </Marker>
    );
});
