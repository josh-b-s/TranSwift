import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Play, Square } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { selectDisplayedJourney } from '@/store/route.slice';
import { endTrip, startTrip } from '@/store/trip.slice';
import { stepsFromJourney } from '@/services/trips/tripSteps';
import { loadBests } from '@/services/trips/bestsStore';
import { formatPaceDelta } from '@/services/trips/tripFormat';
import { SPEED_UNITS } from '@/constants/speedUnits';
import { ACCENT, useThemeStyle } from '@/constants/themes';

/** Starts the selected journey as a trip, or shows the current step of the running one. */
export default function TripButton() {
    const dispatch = useDispatch<AppDispatch>();
    const theme = useThemeStyle();
    const unit = SPEED_UNITS[useSelector((s: RootState) => s.preferences.speedUnit)];
    const journey = useSelector(selectDisplayedJourney);
    const { startedAt, steps, stepIndex, bests, paceS } = useSelector((s: RootState) => s.trip);

    const running = startedAt !== null;
    if (!running && !journey?.segments.length) return null;

    const step = steps[stepIndex];
    const label = running
        ? `${step.type === 'walk' ? 'Walk' : 'Ride'} to ${step.to}`
        : 'Start trip';
    const best = running && step.type === 'walk' && step.bestKey ? bests.legs[step.bestKey] : undefined;
    const pace = paceS === null ? '' : `${formatPaceDelta(paceS)} · `;
    const hint = best ? `${pace}Beat ${(best.avgSpeedMps * unit.perMps).toFixed(1)} ${unit.label} · tap to end` : 'Tap to end';
    const Icon = running ? Square : Play;
    const color = running ? theme.color : '#fff';

    const onPress = () => {
        Haptics.selectionAsync();
        if (running) {
            dispatch(endTrip());
        } else if (journey) {
            const tripSteps = stepsFromJourney(journey);
            loadBests()
                .then(loaded => dispatch(startTrip({ startedAt: Date.now(), steps: tripSteps, bests: loaded })))
                .catch(err => Alert.alert('Could not start trip', String(err)));
        }
    };

    return (
        <View style={{ paddingHorizontal: 24, paddingBottom: 12 }}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={running ? `End trip. ${label}. ${hint}` : 'Start trip'}
                onPress={onPress}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 24,
                    backgroundColor: running ? theme.backgroundColor : ACCENT,
                }}
            >
                <Icon size={16} color={color} />
                <View style={{ flexShrink: 1, alignItems: 'center' }}>
                    <Text numberOfLines={1} style={{ color, fontSize: 15, fontWeight: '700' }}>{label}</Text>
                    {running && <Text style={{ color, opacity: 0.5, fontSize: 12 }}>{hint}</Text>}
                </View>
            </Pressable>
        </View>
    );
}