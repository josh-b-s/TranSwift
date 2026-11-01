import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Bus, Footprints, Route, Square } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { requestEndTrip, setLeftEarlyAt } from '@/store/trip.slice';
import { SPEED_UNITS } from '@/constants/speedUnits';
import { ACCENT, RADIUS, useThemeStyle } from '@/constants/themes';
import { formatPaceDelta, stopsToGo } from '@/services/trips/tripFormat';
import { useFindAlternatives } from '@/hooks/findAlternatives';
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
    const findAlternatives = useFindAlternatives();
    const unit = SPEED_UNITS[useSelector((s: RootState) => s.preferences.speedUnit)];
    const { startedAt, steps, stepIndex, bests, paceS, stopsLeft, leftEarlyAt } = useSelector((s: RootState) => s.trip);

    const step = steps[stepIndex];
    if (startedAt === null || !step) return null;

    const best = step.type === 'walk' && step.bestKey ? bests.legs[step.bestKey] : undefined;
    const pace = paceS === null ? '' : `${formatPaceDelta(paceS)} · `;
    const detail = best
        ? `${pace}Beat ${(best.avgSpeedMps * unit.perMps).toFixed(1)} ${unit.label}`
        : step.type === 'transit' && stopsLeft !== null ? stopsToGo(stopsLeft) : null;
    const next = nextStepLine(steps[stepIndex + 1]);
    const Icon = step.type === 'walk' ? Footprints : Bus;

    const leftRoute = leftEarlyAt !== null && step.type === 'transit' ? step.routeName : null;

    return (
        <View style={{ paddingHorizontal: 24, paddingBottom: 12, gap: 8 }}>
            {leftRoute !== null && (
                <View style={{ padding: 14, borderRadius: RADIUS.card, backgroundColor: theme.backgroundColor, gap: 10 }}>
                    <Text style={{ color: theme.color, fontSize: 14, fontWeight: '600' }}>
                        Looks like you got off the {leftRoute} at {leftEarlyAt}. Look for another way?
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable
                            accessibilityRole="button"
                            onPress={() => {
                                Haptics.selectionAsync();
                                dispatch(setLeftEarlyAt(null));
                                findAlternatives(true);
                            }}
                            style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 20, backgroundColor: ACCENT }}
                        >
                            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>See options</Text>
                        </Pressable>
                        <Pressable
                            accessibilityRole="button"
                            onPress={() => dispatch(setLeftEarlyAt(null))}
                            style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 20, backgroundColor: theme.hairline }}
                        >
                            <Text style={{ color: theme.color, fontSize: 14, fontWeight: '600' }}>Not now</Text>
                        </Pressable>
                    </View>
                </View>
            )}
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
                    accessibilityLabel="Find alternatives"
                    hitSlop={8}
                    onPress={() => {
                        Haptics.selectionAsync();
                        findAlternatives();
                    }}
                    style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.hairline }}
                >
                    <Route size={16} color={theme.color} />
                </Pressable>
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
