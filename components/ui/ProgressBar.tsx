import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

type Props = {
    /** 0 to 1 */
    fraction: number;
    color: string;
    trackColor: string;
};

export default function ProgressBar({ fraction, color, trackColor }: Props) {
    const width = useSharedValue(fraction);

    useEffect(() => {
        width.value = withTiming(fraction, { duration: 300 });
    }, [fraction, width]);

    const fillStyle = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

    return (
        <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
            style={{ height: 8, borderRadius: 4, backgroundColor: trackColor, overflow: 'hidden' }}
        >
            <Animated.View style={[{ height: '100%', borderRadius: 4, backgroundColor: color }, fillStyle]} />
        </View>
    );
}
