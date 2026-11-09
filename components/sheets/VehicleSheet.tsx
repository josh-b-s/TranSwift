import React, { forwardRef } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { X } from 'lucide-react-native';
import { ACCENT, RADIUS, SHADOW, TOP_SAFE, useThemeStyle } from '@/constants/themes';
import DepartureTripStops from '@/components/sheets/DepartureTripStops';
import { useVehicleDeparture } from '@/hooks/vehicleDeparture';
import type { MapVehicle } from '@/services/gtfs/vehicles/vehicleRoutes';

type Props = {
    /** The tapped vehicle, as last reported. Null while no vehicle is picked. */
    vehicle: MapVehicle | null;
    /** Where the vehicle's trip ends, when known. */
    terminus: string | null;
    animatedPosition: SharedValue<number>;
    onClose: () => void;
};

/** The next stops of a tapped vehicle, the way a stop's sheet lists its departures. */
const VehicleSheet = forwardRef<BottomSheetModal, Props>(({ vehicle, terminus, animatedPosition, onClose }, ref) => {
    const theme = useThemeStyle();
    const tabBarHeight = useBottomTabBarHeight();
    const { departure, loading } = useVehicleDeparture(vehicle, terminus);
    const noteStyle = { color: theme.muted, fontSize: 14, textAlign: 'center' as const, padding: 24 };

    return (
        <BottomSheetModal
            ref={ref}
            animatedPosition={animatedPosition}
            backgroundStyle={{
                backgroundColor: theme.surfaceColor,
                borderTopLeftRadius: RADIUS.sheet,
                borderTopRightRadius: RADIUS.sheet,
            }}
            handleIndicatorStyle={{ backgroundColor: theme.color + '55', width: 40 }}
            style={[SHADOW, { borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet }]}
            topInset={TOP_SAFE(useSafeAreaInsets())}
            bottomInset={tabBarHeight}
            index={1}
            snapPoints={['16%', '45%', '100%']}
            enableDynamicSizing={false}
            onDismiss={onClose}
        >
            <BottomSheetScrollView stickyHeaderIndices={[0]} contentContainerStyle={{ paddingBottom: 24 }}>
                <View style={{ backgroundColor: theme.surfaceColor, paddingTop: 8 }}>
                    {vehicle && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingBottom: 12 }}>
                            <View style={{ minWidth: 52, height: 36, paddingHorizontal: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: vehicle.color }}>
                                <Text numberOfLines={1} style={{ color: vehicle.textColor, fontSize: 15, fontWeight: '800' }}>{vehicle.routeName}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text numberOfLines={1} style={{ color: theme.color, fontSize: 19, fontWeight: '800', letterSpacing: -0.3 }}>
                                    {terminus ? `to ${terminus}` : vehicle.routeName}
                                </Text>
                                <Text style={{ color: theme.muted, fontSize: 13, marginTop: 1 }}>Next stops</Text>
                            </View>
                            <Pressable
                                onPress={onClose}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel="Close vehicle"
                                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.hairline, alignItems: 'center', justifyContent: 'center' }}
                            >
                                <X size={18} color={theme.color} />
                            </Pressable>
                        </View>
                    )}
                </View>

                {loading && <ActivityIndicator style={{ padding: 24 }} color={ACCENT} />}
                {!loading && !departure && <Text style={noteStyle}>No stops to show for this trip.</Text>}
                {departure && (
                    <View style={{ paddingHorizontal: 24 }}>
                        <DepartureTripStops departure={departure} />
                        <Text style={{ ...noteStyle, fontSize: 12 }}>Scheduled times, live where the operator reports delays.</Text>
                    </View>
                )}
            </BottomSheetScrollView>
        </BottomSheetModal>
    );
});

VehicleSheet.displayName = 'VehicleSheet';

export default VehicleSheet;
