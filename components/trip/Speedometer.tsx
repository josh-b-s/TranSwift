import React from 'react';
import { Text, View } from 'react-native';
import Animated, { SharedValue } from 'react-native-reanimated';
import { useSelector } from 'react-redux';
import { useIsFocused } from '@react-navigation/native';
import { RootState } from '@/store/store';
import { useCurrentSpeedMps } from '@/hooks/currentSpeed';
import { useSheetFollowTop } from '@/hooks/sheetFollowTop';
import { SHADOW, useThemeStyle } from '@/constants/themes';
import { SPEED_UNITS } from '@/constants/speedUnits';

export default function Speedometer({ animatedPosition }: { animatedPosition: SharedValue<number> }) {
    const theme = useThemeStyle();
    const unit = SPEED_UNITS[useSelector((s: RootState) => s.preferences.speedUnit)];
    const top = useSheetFollowTop(animatedPosition);
    // The Map tab stays mounted when you switch away, so stop the GPS watch there.
    const speedMps = useCurrentSpeedMps(useIsFocused());

    // GPS jitter reports a stationary phone as a fraction of a unit; rounding hides it.
    const speed = speedMps === null ? null : Math.max(0, Math.round(speedMps * unit.perMps));
    const label = speed === null ? '--' : String(speed);

    return (
        <Animated.View style={{ top }} pointerEvents="none">
            <View
                className="absolute bottom-5 left-4 w-14 h-14 rounded-full items-center justify-center"
                style={[{ backgroundColor: theme.backgroundColor }, SHADOW]}
                accessible
                accessibilityLabel={speed === null ? 'Speed unavailable' : `Speed ${speed} ${unit.spoken}`}
            >
                <Text style={{ color: theme.color, fontSize: 18, fontWeight: '700', lineHeight: 20 }}>{label}</Text>
                <Text style={{ color: theme.color, opacity: 0.5, fontSize: 9, fontWeight: '600' }}>{unit.label}</Text>
            </View>
        </Animated.View>
    );
}
