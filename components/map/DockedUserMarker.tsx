import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { ACCURACY_FILL, ACCURACY_STROKE } from '@/components/map/accuracyColors';
import { userMarkerImage } from '@/components/map/userMarkerImages';

// The marker images are drawn at this size.
const SIZE = 120;

/**
 * The user's arrow and accuracy circle fixed over the map, for when the camera is locked onto them. `drop` is how far
 * below the middle of the screen they sit, in dp. `pitch` is the map's tilt in degrees, which lays them down on the
 * ground the same way, and `turn` is how far the arrow is turned from straight up. `perspective` is how far the viewer
 * is from the ground, in dp, as the map projects it. `dpPerMetre` sizes the circle, whose radius is `accuracyM` metres.
 * All five are shared values so they can follow the map every frame without rendering.
 */
export default function DockedUserMarker({ drop, pitch, turn, dpPerMetre, perspective, accuracyM, accuracyLevel }: {
    drop: SharedValue<number>;
    pitch: SharedValue<number>;
    turn: SharedValue<number>;
    dpPerMetre: SharedValue<number>;
    perspective: SharedValue<number>;
    accuracyM: number | null;
    accuracyLevel: number | null;
}) {
    // Both are moved down first, then laid flat and tipped back with the map.
    const arrowStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: drop.value }, { perspective: perspective.value }, { rotateX: `${pitch.value}deg` }, { rotate: `${turn.value}deg` }],
    }));
    const circleStyle = useAnimatedStyle(() => {
        const diameter = 2 * (accuracyM ?? 0) * dpPerMetre.value;
        return {
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            transform: [{ translateY: drop.value }, { perspective: perspective.value }, { rotateX: `${pitch.value}deg` }],
        };
    });

    return (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
            {accuracyM !== null && (
                <Animated.View
                    style={[{ position: 'absolute', backgroundColor: ACCURACY_FILL, borderColor: ACCURACY_STROKE, borderWidth: 1 }, circleStyle]}
                />
            )}
            <Animated.Image source={userMarkerImage(accuracyLevel)} style={[{ width: SIZE, height: SIZE }, arrowStyle]} />
        </View>
    );
}
