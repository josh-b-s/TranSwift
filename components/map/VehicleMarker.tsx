import React, { memo } from 'react';
import { Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import Svg, { Circle, G } from 'react-native-svg';
import type { MapVehicle } from '@/services/gtfs/vehicles/vehicleRoutes';
import { badgeText } from '@/services/gtfs/vehicles/badgeText';
import { CENTER, SELECTED_SCALE, SIZE } from '@/components/map/vehicleMarkerSize';
import { useSnapshotWhileChanging } from '@/components/map/useSnapshotWhileChanging';

const DISC_R = 11;
const RING_R = DISC_R + 2;
// A selected marker is drawn on a canvas this much taller above and below, and wider, so the name label fits under the
// badge while the badge stays at the middle, where the marker is anchored.
const LABEL_H = 20;
const LABEL_CANVAS_W = 160;

type Props = { vehicle: MapVehicle; selected: boolean; terminus: string | null; onPress: (vehicle: MapVehicle) => void };

/**
 * A route badge in the route's colour, facing the screen so its text stays readable. Selected, it is larger and shows
 * the route name, and where the trip ends, under it.
 */
export default memo(function VehicleMarker({ vehicle, selected, terminus, onPress }: Props) {
    const label = terminus ? `${vehicle.routeName} to ${terminus}` : vehicle.routeName;
    const tracking = useSnapshotWhileChanging([vehicle.routeName, vehicle.color, vehicle.textColor, selected, label]);
    const scale = selected ? SELECTED_SCALE : 1;

    return (
        <Marker
            coordinate={{ latitude: vehicle.latitude, longitude: vehicle.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={tracking}
            zIndex={selected ? 10 : 5}
            onPress={() => onPress(vehicle)}
            accessibilityLabel={`${label}${vehicle.label ? `, ${vehicle.label}` : ''}`}
        >
            <View
                style={{
                    width: selected ? LABEL_CANVAS_W : SIZE, height: selected ? SIZE + 2 * LABEL_H : SIZE,
                    alignItems: 'center', justifyContent: 'center',
                }}
            >
                <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
                    <G scale={scale} originX={CENTER} originY={CENTER}>
                        <Circle cx={CENTER} cy={CENTER} r={RING_R} fill="#FFFFFF" />
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
                            {label}
                        </Text>
                    </View>
                )}
            </View>
        </Marker>
    );
});
