import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { CircleCheck, CirclePlus, CircleX, Footprints, type LucideIcon, Moon, Pencil, RotateCcw, Smartphone, Sun, Trash2 } from 'lucide-react-native';
import { nanoid } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { ACCENT, DANGER, RADIUS, useThemeStyle } from '@/constants/themes';
import { SPEED_UNITS } from '@/constants/speedUnits';
import { MAX_MAX_WALK_DISTANCE_M, MIN_MAX_WALK_DISTANCE_M, WALK_DISTANCE_STEP_M } from '@/constants/walkLimit';
import { MAX_WEEKLY_GOAL_M, NO_WEEKLY_GOAL_M, WEEKLY_GOAL_STEP_M } from '@/constants/walkGoal';
import { formatDistance } from '@/services/trips/tripFormat';
import SegmentedControl from '@/components/ui/SegmentedControl';
import SettingsSection from '@/components/ui/SettingsSection';
import StepperRow from '@/components/ui/StepperRow';
import {
    addWalkingSpeed,
    removeWalkingSpeed,
    resetPreferences,
    setMaxWalkDistance,
    setSpeedUnit,
    setThemeMode,
    setVehicleScope,
    setWeeklyGoal,
    updateWalkingSpeed,
    type SpeedUnit,
    type ThemeMode,
    type VehicleScope,
} from '@/store/preferences.slice';

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: LucideIcon }[] = [
    { value: 'system', label: 'System', icon: Smartphone },
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
];

const SPEED_UNIT_OPTIONS: { value: SpeedUnit; label: string }[] = [
    { value: 'kmh', label: SPEED_UNITS.kmh.label },
    { value: 'mph', label: SPEED_UNITS.mph.label },
];

const VEHICLE_SCOPE_OPTIONS: { value: VehicleScope; label: string }[] = [
    { value: 'routes', label: 'Route only' },
    { value: 'nearby', label: 'All nearby' },
];

export default function Preferences() {
    const theme = useThemeStyle();
    const dispatch = useDispatch<AppDispatch>();
    const themeMode = useSelector((s: RootState) => s.preferences.themeMode);
    const walkingSpeeds = useSelector((s: RootState) => s.preferences.walkingSpeeds);
    const speedUnit = useSelector((s: RootState) => s.preferences.speedUnit);
    const maxWalkDistanceM = useSelector((s: RootState) => s.preferences.maxWalkDistanceM);
    const weeklyGoalM = useSelector((s: RootState) => s.preferences.weeklyGoalM);
    const vehicleScope = useSelector((s: RootState) => s.preferences.vehicleScope);

    // Inline-edit state for the walking speed list — editingId names which
    // row is currently showing text inputs instead of static text; the two
    // drafts hold that row's in-progress values until Save is pressed.
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draftLabel, setDraftLabel] = useState('');
    const [draftMps, setDraftMps] = useState('');

    function startEditing(id: string, label: string, mps: number) {
        setEditingId(id);
        setDraftLabel(label);
        setDraftMps(String(mps));
    }

    function cancelEditing() {
        setEditingId(null);
    }

    function saveEditing() {
        if (!editingId) return;
        const mps = parseFloat(draftMps);
        const label = draftLabel.trim();
        if (!label || !Number.isFinite(mps) || mps <= 0) {
            Alert.alert('Invalid speed', 'Give it a name and a speed greater than 0.');
            return;
        }
        dispatch(updateWalkingSpeed({ id: editingId, label, mps }));
        setEditingId(null);
    }

    function handleAddSpeed() {
        const id = nanoid();
        dispatch(addWalkingSpeed({ id, label: 'New speed', mps: 1.2 }));
        // Drop straight into edit mode so the user names/sets it right away
        // instead of leaving a placeholder "New speed" row sitting there.
        startEditing(id, 'New speed', 1.2);
    }

    function handleRemoveSpeed(id: string) {
        if (walkingSpeeds.length <= 1) {
            Alert.alert("Can't remove", 'Keep at least one walking speed.');
            return;
        }
        Alert.alert('Remove speed?', 'This preset will be removed from the list.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => dispatch(removeWalkingSpeed(id)) },
        ]);
    }

    function handleReset() {
        Alert.alert(
            'Reset to defaults?',
            'Theme, speedometer unit, vehicles on the map, walk limit, weekly goal and walking speeds will be reset to their default values.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Reset', style: 'destructive', onPress: () => { setEditingId(null); dispatch(resetPreferences()); } },
            ],
        );
    }

    return (
        <ScrollView style={{ flex: 1, backgroundColor: theme.surfaceColor }} contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 40 }}>
            <SettingsSection title="Theme">
                <SegmentedControl
                    options={THEME_OPTIONS}
                    value={themeMode}
                    onChange={(mode) => dispatch(setThemeMode(mode))}
                />
            </SettingsSection>

            <SettingsSection title="Speedometer unit">
                <SegmentedControl
                    options={SPEED_UNIT_OPTIONS}
                    value={speedUnit}
                    onChange={(unit) => dispatch(setSpeedUnit(unit))}
                />
            </SettingsSection>

            <SettingsSection
                title="Vehicles on the map"
                hint="Route only shows vehicles on the routes you are looking at. All nearby also shows every tracked vehicle in view once you zoom in as far as the stop dots, up to the 60 closest to the centre."
            >
                <SegmentedControl
                    options={VEHICLE_SCOPE_OPTIONS}
                    value={vehicleScope}
                    onChange={(scope) => dispatch(setVehicleScope(scope))}
                />
            </SettingsSection>

            <SettingsSection title="Maximum walk" hint="The farthest the router may send you on foot in one search. Applies to your next search.">
                <StepperRow
                    label={formatDistance(maxWalkDistanceM)}
                    onDecrease={() => dispatch(setMaxWalkDistance(maxWalkDistanceM - WALK_DISTANCE_STEP_M))}
                    onIncrease={() => dispatch(setMaxWalkDistance(maxWalkDistanceM + WALK_DISTANCE_STEP_M))}
                    canDecrease={maxWalkDistanceM > MIN_MAX_WALK_DISTANCE_M}
                    canIncrease={maxWalkDistanceM < MAX_MAX_WALK_DISTANCE_M}
                    decreaseLabel="Decrease maximum walk"
                    increaseLabel="Increase maximum walk"
                />
            </SettingsSection>

            <SettingsSection title="Weekly walking goal" hint="Shown with your progress on the History tab. Leave it off for no goal.">
                <StepperRow
                    label={weeklyGoalM > NO_WEEKLY_GOAL_M ? formatDistance(weeklyGoalM) : 'Off'}
                    onDecrease={() => dispatch(setWeeklyGoal(weeklyGoalM - WEEKLY_GOAL_STEP_M))}
                    onIncrease={() => dispatch(setWeeklyGoal(weeklyGoalM + WEEKLY_GOAL_STEP_M))}
                    canDecrease={weeklyGoalM > NO_WEEKLY_GOAL_M}
                    canIncrease={weeklyGoalM < MAX_WEEKLY_GOAL_M}
                    decreaseLabel="Decrease weekly goal"
                    increaseLabel="Increase weekly goal"
                />
            </SettingsSection>

            <SettingsSection title="Walking speeds" hint="These are the presets the walking-speed pill on the route sheet cycles through.">
                {walkingSpeeds.map((option) => {
                    const isEditing = editingId === option.id;
                    return (
                        <View
                            key={option.id}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 10,
                                padding: 14,
                                borderRadius: RADIUS.tile,
                                backgroundColor: theme.backgroundColor,
                            }}
                        >
                            <View
                                style={{
                                    width: 36, height: 36, borderRadius: 10,
                                    backgroundColor: theme.accentSoft,
                                    alignItems: 'center', justifyContent: 'center',
                                }}
                            >
                                <Footprints size={18} color={ACCENT} />
                            </View>

                            {isEditing ? (
                                <>
                                    <View style={{ flex: 1, gap: 6 }}>
                                        <TextInput
                                            value={draftLabel}
                                            onChangeText={setDraftLabel}
                                            placeholder="Name"
                                            placeholderTextColor={theme.color + '66'}
                                            style={{
                                                color: theme.color, fontSize: 15, fontWeight: '600',
                                                borderBottomWidth: 1, borderBottomColor: theme.color + '33', paddingVertical: 2,
                                            }}
                                        />
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <TextInput
                                                value={draftMps}
                                                onChangeText={setDraftMps}
                                                placeholder="1.4"
                                                placeholderTextColor={theme.color + '66'}
                                                keyboardType="decimal-pad"
                                                style={{
                                                    color: theme.color, fontSize: 13, opacity: 0.8, width: 64,
                                                    borderBottomWidth: 1, borderBottomColor: theme.color + '33', paddingVertical: 2,
                                                }}
                                            />
                                            <Text style={{ color: theme.color, opacity: 0.5, fontSize: 12 }}>m/s</Text>
                                        </View>
                                    </View>
                                    <Pressable onPress={saveEditing} hitSlop={8} style={{ padding: 4 }}>
                                        <CircleCheck size={24} color="#22c55e" />
                                    </Pressable>
                                    <Pressable onPress={cancelEditing} hitSlop={8} style={{ padding: 4 }}>
                                        <CircleX size={24} color={theme.color} style={{ opacity: 0.4 }} />
                                    </Pressable>
                                </>
                            ) : (
                                <>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: theme.color, fontSize: 15, fontWeight: '600' }}>{option.label}</Text>
                                        <Text style={{ color: theme.muted, fontSize: 12, marginTop: 1 }}>
                                            {option.mps.toFixed(1)} m/s
                                        </Text>
                                    </View>
                                    <Pressable
                                        onPress={() => startEditing(option.id, option.label, option.mps)}
                                        hitSlop={8}
                                        style={{ padding: 4 }}
                                    >
                                        <Pencil size={18} color={theme.color} style={{ opacity: 0.6 }} />
                                    </Pressable>
                                    <Pressable
                                        onPress={() => handleRemoveSpeed(option.id)}
                                        hitSlop={8}
                                        style={{ padding: 4, opacity: walkingSpeeds.length <= 1 ? 0.3 : 1 }}
                                    >
                                        <Trash2 size={18} color={DANGER} />
                                    </Pressable>
                                </>
                            )}
                        </View>
                    );
                })}

                <Pressable
                    onPress={handleAddSpeed}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: 14,
                        borderRadius: RADIUS.tile,
                        borderWidth: 1.5,
                        borderStyle: 'dashed',
                        borderColor: ACCENT + '88',
                    }}
                >
                    <CirclePlus size={18} color={ACCENT} />
                    <Text style={{ color: ACCENT, fontSize: 14, fontWeight: '600' }}>Add speed</Text>
                </Pressable>
            </SettingsSection>

            <SettingsSection title="Reset">
                <Pressable
                    onPress={handleReset}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: 14,
                        borderRadius: RADIUS.tile,
                        backgroundColor: theme.backgroundColor,
                    }}
                >
                    <RotateCcw size={18} color={DANGER} />
                    <Text style={{ color: DANGER, fontSize: 14, fontWeight: '600' }}>Reset settings to default</Text>
                </Pressable>
            </SettingsSection>
        </ScrollView>
    );
}
