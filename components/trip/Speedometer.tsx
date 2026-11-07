import React from 'react';
import { Text, View } from 'react-native';
import Animated, { SharedValue } from 'react-native-reanimated';
import { useSelector } from 'react-redux';
import { useIsFocused } from '@react-navigation/native';
import { RootState } from '@/store/store';
import { useCurrentSpeedMps } from '@/hooks/currentSpeed';
import { useSheetFollowTop } from '@/hooks/sheetFollowTop';
import { DANGER, SHADOW, SUCCESS, useThemeStyle } from '@/constants/themes';
import { SPEED_UNITS } from '@/constants/speedUnits';
import { speedVerdict } from '@/services/trips/requiredSpeed';

export default function Speedometer({ animatedPosition }: { animatedPosition: SharedValue<number> }) {
    const theme = useThemeStyle();
    const unit = SPEED_UNITS[useSelector((s: RootState) => s.preferences.speedUnit)];
    const top = useSheetFollowTop(animatedPosition);
    // The Map tab stays mounted when you switch away, so stop the GPS watch there.
    const speedMps = useCurrentSpeedMps(useIsFocused());

    // GPS jitter reports a stationary phone as a fraction of a unit; rounding hides it.
    const speed = speedMps === null ? null : Math.max(0, Math.round(speedMps * unit.perMps));
    const requiredMps = useSelector((s: RootState) => s.trip.requiredMps);
    const verdict = speedMps === null || requiredMps === null ? null : speedVerdict(speedMps, requiredMps);
    const verdictColor = verdict === null ? undefined : verdict.onTime ? SUCCESS : DANGER;
    const verdictText = verdict === null ? null : verdict.onTime
        ? `on pace, ${Math.round(verdict.marginMps * unit.perMps)} ${unit.label} faster than needed`
        : `+${Math.ceil(-verdict.marginMps * unit.perMps)} ${unit.label} to arrive on time`;
    const label = speed === null ? '--' : String(speed);

    return (
        <Animated.View style={{ top }} pointerEvents="none">
            <View
                className="absolute bottom-5 left-4 w-14 h-14 rounded-full items-center justify-center"
                style={[{ backgroundColor: theme.backgroundColor, borderWidth: 3, borderColor: verdictColor ?? 'transparent' }, SHADOW]}
                accessible
                accessibilityLabel={`${speed === null ? 'Speed unavailable' : `Speed ${speed} ${unit.spoken}`}${verdictText ? `, ${verdictText}` : ''}`}
            >
                <Text style={{ color: theme.color, fontSize: 18, fontWeight: '700', lineHeight: 20 }}>{label}</Text>
                <Text style={{ color: theme.color, opacity: 0.5, fontSize: 9, fontWeight: '600' }}>{unit.label}</Text>
            </View>
            {verdictText !== null && (
                <View
                    className="absolute bottom-6 left-20 px-3 py-1.5 rounded-full"
                    style={[{ backgroundColor: verdictColor }, SHADOW]}
                >
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{verdictText}</Text>
                </View>
            )}
        </Animated.View>
    );
}
