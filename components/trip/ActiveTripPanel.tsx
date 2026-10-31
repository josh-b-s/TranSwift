import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Bus, Footprints, Square } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { requestEndTrip } from '@/store/trip.slice';
import { SPEED_UNITS } from '@/constants/speedUnits';
import { ACCENT, RADIUS, useThemeStyle } from '@/constants/themes';
import { formatPaceDelta, stopsToGo } from '@/services/trips/tripFormat';
import { nextStepLine, stepHeadline } from '@/services/trips/stepText';

const confirmEnd = (onEnd: () => void) =>
    Alert.alert('End trip?', 'The trip is saved to your history if you have reached the first boarding stop.', [
        { text: 'Keep going', style: 'cancel' },
        { text: 'End trip', style: 'destructive', onPress: onEnd },
    ]);

/** The running trip, pinned at the top of the route sheet: what to do now, how far along the ride is, what comes next. */
export default function ActiveTripPanel() {
    const dispatch = useDispatch<AppDispatch>();
    const theme = useThemeStyle();
    const unit = SPEED_UNITS[useSelector((s: RootState) => s.preferences.speedUnit)];
    const { startedAt, steps, stepIndex, bests, paceS, stopsLeft } = useSelector((s: RootState) => s.trip);

    const step = steps[stepIndex];
    if (startedAt === null || !step) return null;

    const best = step.type === 'walk' && step.bestKey ? bests.legs[step.bestKey] : undefined;
    const pace = paceS === null ? '' : `${formatPaceDelta(paceS)} · `;
    const detail = best
        ? `${pace}Beat ${(best.avgSpeedMps * unit.perMps).toFixed(1)} ${unit.label}`
        : step.type === 'transit' && stopsLeft !== null ? stopsToGo(stopsLeft) : null;
    const next = nextStepLine(steps[stepIndex + 1]);
    const Icon = step.type === 'walk' ? Footprints : Bus;

    return (
        <View style={{ paddingHorizontal: 24, paddingBottom: 12 }}>
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 14,
                    borderRadius: RADIUS.card,
                    backgroundColor: theme.backgroundColor,
                }}
            >
                <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accentSoft }}>
                    <Icon size={18} color={ACCENT} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                    <Text numberOfLines={1} style={{ color: theme.color, fontSize: 16, fontWeight: '700' }}>
                        {stepHeadline(step, stopsLeft !== null)}
                    </Text>
                    {!!detail && <Text numberOfLines={1} style={{ color: ACCENT, fontSize: 13, fontWeight: '600' }}>{detail}</Text>}
                    {!!next && <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 12 }}>{next}</Text>}
                </View>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="End trip"
                    hitSlop={8}
                    onPress={() => {
                        Haptics.selectionAsync();
                        confirmEnd(() => dispatch(requestEndTrip()));
                    }}
                    style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.hairline }}
                >
                    <Square size={16} color={theme.color} />
                </Pressable>
            </View>
        </View>
    );
}
