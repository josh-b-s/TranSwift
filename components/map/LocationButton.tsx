import React, { RefObject } from 'react';
import { TouchableOpacity, View } from 'react-native';
import ArrowLogo from '@/components/ui/ArrowLogo';
import Animated, { SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store/store';
import { setUserLocation } from '@/store/location.slice';
import MapView, { LatLng } from 'react-native-maps';
import * as Location from 'expo-location';
import { SHADOW, useThemeStyle } from '@/constants/themes';
import {useGoToUserLocation} from "@/hooks/goToUserLocation";
import {useSheetFollowTop} from "@/hooks/sheetFollowTop";

export default function LocationButton({ mapRef, animatedPosition }: {
    mapRef: RefObject<MapView | null>;
    animatedPosition: SharedValue<number>;
}) {
    const dispatch = useDispatch<AppDispatch>();
    const theme = useThemeStyle();
    const clampedTop = useSheetFollowTop(animatedPosition);

    const goToUserLocation = useGoToUserLocation(mapRef);

    return (
        <Animated.View style={{ top: clampedTop }}>
            <TouchableOpacity
                className="absolute bottom-5 right-4 w-14 h-14 rounded-full items-center justify-center"
                style={[{ backgroundColor: theme.backgroundColor }, SHADOW]}
                accessibilityRole="button"
                accessibilityLabel="Center map on my location"
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    goToUserLocation();
                }}
            >
                <View style={{ transform: [{ rotate: '45deg' }] }}>
                    <ArrowLogo width={22} />
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
}