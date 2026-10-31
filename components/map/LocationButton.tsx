import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { LocateFixed } from 'lucide-react-native';
import ArrowLogo from '@/components/ui/ArrowLogo';
import Animated, { SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ACCENT, SHADOW, useThemeStyle } from '@/constants/themes';
import { useSheetFollowTop } from '@/hooks/sheetFollowTop';
import type { FollowMode } from '@/hooks/mapFollow';

const LABELS: Record<FollowMode, string> = {
    free: 'Center map on my location',
    centered: 'Follow my direction',
    heading: 'Stop following my direction',
};

/** Locate icon while the map is off the user, the arrow tipped 45 degrees once centered, and upright when following their direction. */
export default function LocationButton({ mode, onPress, animatedPosition }: {
    mode: FollowMode;
    onPress: () => void;
    animatedPosition: SharedValue<number>;
}) {
    const theme = useThemeStyle();
    const clampedTop = useSheetFollowTop(animatedPosition);

    return (
        <Animated.View style={{ top: clampedTop }}>
            <TouchableOpacity
                style={[
                    {
                        position: 'absolute', bottom: 20, right: 16, width: 56, height: 56, borderRadius: 28,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: theme.backgroundColor,
                        // Ringed while the map is following the user.
                        borderWidth: 2, borderColor: mode === 'free' ? 'transparent' : ACCENT,
                    },
                    SHADOW,
                ]}
                accessibilityRole="button"
                accessibilityLabel={LABELS[mode]}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onPress();
                }}
            >
                {mode === 'free' ? (
                    <LocateFixed size={24} color={theme.color} />
                ) : (
                    <View style={{ transform: [{ rotate: mode === 'centered' ? '45deg' : '0deg' }] }}>
                        <ArrowLogo width={22} />
                    </View>
                )}
            </TouchableOpacity>
        </Animated.View>
    );
}
