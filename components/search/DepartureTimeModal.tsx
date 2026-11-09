import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { SHADOW, useThemeStyle } from '@/constants/themes';
import WheelPicker from '@/components/ui/WheelPicker';
import SegmentedControl from '@/components/ui/SegmentedControl';

type Props = {
    visible: boolean;
    /** Current value, or null for "leave now." */
    value: number | null;
    /** Whether `value` is a time to arrive by. */
    arriveBy: boolean;
    onClose: () => void;
    /** Called with epoch ms on Confirm, or null on "Leave now." */
    onConfirm: (epochMs: number | null, arriveBy: boolean) => void;
};

const DAY_LABELS_AHEAD = 6; // "Today" + next 6 days, a week's worth of choices
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function startOfDay(d: Date): Date {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

function dayLabel(d: Date, todayStart: Date): string {
    const diffDays = Math.round((startOfDay(d).getTime() - todayStart.getTime()) / 86_400_000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Custom departure date and time picker, used instead of @react-native-community/datetimepicker. Its mode="datetime" chains
 * two native dialogs on Android, and that reopen/dismiss cycle crashes (upstream issues #768 and #907, still open).
 * Two single-mode pickers avoided the crash but flashed a jarring dialog transition. This one is three snapping wheels
 * (day, hour, minute) built on a ScrollView, so it looks the same on both platforms.
 */
export default function DepartureTimeModal({ visible, value, arriveBy, onClose, onConfirm }: Props) {
    const theme = useThemeStyle();

    // Working copy: only committed to the parent on Confirm, so dismissing never mutates the real value.
    const [dayIdx, setDayIdx] = useState(0);
    const [hour, setHour] = useState(0);
    const [minute, setMinute] = useState(0);
    const [arrive, setArrive] = useState(false);

    // Re-sync each time the modal opens, so reopening after a Confirm doesn't show the previous session's leftovers.
    useEffect(() => {
        if (!visible) return;
        const d = value ? new Date(value) : new Date();
        const day = Math.round((startOfDay(d).getTime() - startOfDay(new Date()).getTime()) / 86_400_000);
        setDayIdx(Math.min(DAY_LABELS_AHEAD, Math.max(0, day)));
        setHour(d.getHours());
        setMinute(d.getMinutes());
        setArrive(value !== null && arriveBy);
    }, [visible, value, arriveBy]);

    const todayStart = startOfDay(new Date());
    const days = Array.from({ length: DAY_LABELS_AHEAD + 1 }, (_, i) => {
        const d = new Date(todayStart);
        d.setDate(d.getDate() + i);
        return d;
    });

    function chosenTime(): number {
        const at = new Date(days[dayIdx]);
        at.setHours(hour, minute, 0, 0);
        return at.getTime();
    }

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 }}
                onPress={onClose}
            >
                {/* Inner Pressable with no-op onPress stops the backdrop's onPress
                    from firing when tapping inside the card itself. */}
                <Pressable onPress={() => {}}>
                    <View
                        style={[
                            { backgroundColor: theme.backgroundColor, borderRadius: 28, padding: 20, gap: 16 },
                            SHADOW,
                        ]}
                    >
                        <SegmentedControl
                            options={[{ value: 'depart', label: 'Depart at' }, { value: 'arrive', label: 'Arrive by' }]}
                            value={arrive ? 'arrive' : 'depart'}
                            onChange={(mode) => setArrive(mode === 'arrive')}
                        />

                        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
                            <WheelPicker
                                items={days.map(d => dayLabel(d, todayStart))}
                                index={dayIdx}
                                onChange={setDayIdx}
                                width={120}
                                color={theme.color}
                            />
                            <WheelPicker items={HOURS} index={hour} onChange={setHour} width={56} color={theme.color} />
                            <Text style={{ color: theme.color, fontSize: 24, fontWeight: '700' }}>:</Text>
                            <WheelPicker items={MINUTES} index={minute} onChange={setMinute} width={56} color={theme.color} />
                        </View>

                        {/* Actions */}
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                            <TouchableOpacity
                                style={{ flex: 1, paddingVertical: 12, borderRadius: 16, alignItems: 'center', backgroundColor: theme.color + '11' }}
                                accessibilityRole="button"
                                onPress={() => { onConfirm(null, false); onClose(); }}
                            >
                                <Text style={{ color: theme.color, fontWeight: '600' }}>Leave now</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={{ flex: 1, paddingVertical: 12, borderRadius: 16, alignItems: 'center', backgroundColor: '#2563eb' }}
                                accessibilityRole="button"
                                onPress={() => { onConfirm(chosenTime(), arrive); onClose(); }}
                            >
                                <Text style={{ color: '#fff', fontWeight: '700' }}>Confirm</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
