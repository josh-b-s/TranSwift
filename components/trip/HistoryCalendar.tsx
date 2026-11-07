import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { ACCENT, RADIUS, useThemeStyle } from '@/constants/themes';
import { dayStart, monthGrid, shiftMonth } from '@/services/trips/calendarMonth';
import type { HistoryTrip } from '@/services/trips/tripHistory';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

type Props = {
    trips: HistoryTrip[];
    /** Local midnight of any day in the month shown. */
    monthMs: number;
    onMonthChange: (monthMs: number) => void;
    selectedDayMs: number | null;
    onSelectDay: (dayMs: number) => void;
};

/** One month of history. A day with trips is filled darker the further it was walked, relative to the month's best day. */
export default function HistoryCalendar({ trips, monthMs, onMonthChange, selectedDayMs, onSelectDay }: Props) {
    const theme = useThemeStyle();
    const grid = useMemo(() => monthGrid(monthMs, trips), [monthMs, trips]);
    const todayMs = dayStart(Date.now());
    const longestM = Math.max(0, ...grid.flat().filter(c => c.inMonth).map(c => c.distanceM));
    const title = new Date(monthMs).toLocaleDateString([], { month: 'long', year: 'numeric' });

    const arrow = (delta: number, label: string, Icon: typeof ChevronLeft) => (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            hitSlop={8}
            onPress={() => onMonthChange(shiftMonth(monthMs, delta))}
            style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.hairline }}
        >
            <Icon size={18} color={theme.color} />
        </Pressable>
    );

    return (
        <View style={{ borderRadius: RADIUS.tile, padding: 14, gap: 10, backgroundColor: theme.backgroundColor }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                {arrow(-1, 'Previous month', ChevronLeft)}
                <Text style={{ color: theme.color, fontSize: 16, fontWeight: '700' }}>{title}</Text>
                {arrow(1, 'Next month', ChevronRight)}
            </View>

            <View style={{ flexDirection: 'row' }}>
                {WEEKDAYS.map((label, i) => (
                    <Text key={i} style={{ flex: 1, textAlign: 'center', color: theme.muted, fontSize: 12, fontWeight: '600' }}>{label}</Text>
                ))}
            </View>

            {grid.map((week, w) => (
                <View key={w} style={{ flexDirection: 'row', gap: 4 }}>
                    {week.map(cell => {
                        const selected = cell.dayMs === selectedDayMs;
                        const walked = cell.inMonth && cell.tripCount > 0;
                        // Trips with no walking still get the lightest fill, so the day is not shown as empty.
                        const strength = walked ? 0.25 + 0.65 * (longestM > 0 ? cell.distanceM / longestM : 0) : 0;
                        const onFill = strength > 0.55;
                        return (
                            <Pressable
                                key={cell.dayMs}
                                disabled={!cell.inMonth}
                                accessibilityRole="button"
                                accessibilityLabel={`${new Date(cell.dayMs).toDateString()}, ${cell.tripCount} ${cell.tripCount === 1 ? 'trip' : 'trips'}`}
                                onPress={() => onSelectDay(cell.dayMs)}
                                style={{
                                    flex: 1,
                                    aspectRatio: 1,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 10,
                                    borderWidth: selected || cell.dayMs === todayMs ? 2 : 0,
                                    borderColor: selected ? theme.color : ACCENT,
                                    backgroundColor: walked ? ACCENT + Math.round(strength * 255).toString(16).padStart(2, '0') : 'transparent',
                                    opacity: cell.inMonth ? 1 : 0,
                                }}
                            >
                                <Text style={{ color: onFill ? '#fff' : theme.color, fontSize: 14, fontWeight: walked ? '700' : '500' }}>
                                    {new Date(cell.dayMs).getDate()}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            ))}
        </View>
    );
}
