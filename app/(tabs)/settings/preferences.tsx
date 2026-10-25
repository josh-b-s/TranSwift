import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { CircleCheck, CirclePlus, CircleX, Footprints, type LucideIcon, Moon, Pencil, RotateCcw, Smartphone, Sun, Trash2 } from 'lucide-react-native';
import { nanoid } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { useThemeStyle } from '@/constants/themes';
import { SPEED_UNITS } from '@/constants/speedUnits';
import SegmentedControl from '@/components/ui/SegmentedControl';
import {
    addWalkingSpeed,
    removeWalkingSpeed,
    resetPreferences,
    setSpeedUnit,
    setThemeMode,
    updateWalkingSpeed,
    type SpeedUnit,
    type ThemeMode,
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

function SectionLabel({ text, theme }: { text: string; theme: ReturnType<typeof useThemeStyle> }) {
    return (
        <Text style={{ color: theme.color, opacity: 0.5, fontSize: 13, fontWeight: '600', marginBottom: 4, marginTop: 4 }}>
            {text}
        </Text>
    );
}

export default function Preferences() {
    const theme = useThemeStyle();
    const dispatch = useDispatch<AppDispatch>();
    const themeMode = useSelector((s: RootState) => s.preferences.themeMode);
    const walkingSpeeds = useSelector((s: RootState) => s.preferences.walkingSpeeds);
    const speedUnit = useSelector((s: RootState) => s.preferences.speedUnit);

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
            'Theme, speedometer unit and walking speeds will be reset to their default values.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Reset', style: 'destructive', onPress: () => { setEditingId(null); dispatch(resetPreferences()); } },
            ],
        );
    }

    return (
        <ScrollView style={{ flex: 1, backgroundColor: theme.surfaceColor }} contentContainerStyle={{ padding: 16, gap: 8 }}>
            <SectionLabel text="Theme" theme={theme} />
            <SegmentedControl
                options={THEME_OPTIONS}
                value={themeMode}
                onChange={(mode) => dispatch(setThemeMode(mode))}
            />

            <SectionLabel text="Speedometer unit" theme={theme} />
            <SegmentedControl
                options={SPEED_UNIT_OPTIONS}
                value={speedUnit}
                onChange={(unit) => dispatch(setSpeedUnit(unit))}
            />

            <SectionLabel text="Walking speeds" theme={theme} />
            <Text style={{ color: theme.color, opacity: 0.5, fontSize: 12, marginBottom: 4 }}>
                These are the presets the walking-speed pill on the route sheet cycles through.
            </Text>

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
                            borderRadius: 16,
                            backgroundColor: theme.backgroundColor,
                        }}
                    >
                        <View
                            style={{
                                width: 36, height: 36, borderRadius: 10,
                                backgroundColor: '#2563eb22',
                                alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            <Footprints size={18} color="#2563eb" />
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
                                    <Text style={{ color: theme.color, opacity: 0.5, fontSize: 12, marginTop: 1 }}>
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
                                    <Trash2 size={18} color="#ef4444" />
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
                    borderRadius: 16,
                    borderWidth: 1,
                    borderStyle: 'dashed',
                    borderColor: theme.color + '55',
                }}
            >
                <CirclePlus size={18} color={theme.color} />
                <Text style={{ color: theme.color, fontSize: 14, fontWeight: '600' }}>Add speed</Text>
            </Pressable>

            <SectionLabel text="Reset" theme={theme} />
            <Pressable
                onPress={handleReset}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: 14,
                    borderRadius: 16,
                    backgroundColor: theme.backgroundColor,
                }}
            >
                <RotateCcw size={18} color="#ef4444" />
                <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '600' }}>Reset settings to default</Text>
            </Pressable>
        </ScrollView>
    );
}
