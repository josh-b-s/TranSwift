import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { CalendarDays, Footprints, List, Map as MapIcon } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { viewTrip } from '@/store/tripView.slice';
import { ACCENT, DANGER, useThemeStyle } from '@/constants/themes';
import ScreenHeader from '@/components/ui/ScreenHeader';
import SegmentedControl from '@/components/ui/SegmentedControl';
import HistoryCalendar from '@/components/trip/HistoryCalendar';
import HistoryStats from '@/components/trip/HistoryStats';
import HistoryCharts from '@/components/trip/HistoryCharts';
import WalkingGoal from '@/components/trip/WalkingGoal';
import TripHistoryRow from '@/components/trip/TripHistoryRow';
import { deleteTrip } from '@/services/trips/tripStore';
import { dayStart, tripsOnDay } from '@/services/trips/calendarMonth';
import { historyTotals, loadHistory, type HistoryTrip } from '@/services/trips/tripHistory';

type HistoryView = 'list' | 'calendar';
const VIEW_OPTIONS: { value: HistoryView; label: string; icon: typeof List }[] = [
    { value: 'list', label: 'List', icon: List },
    { value: 'calendar', label: 'Calendar', icon: CalendarDays },
];

export default function HistoryScreen() {
    const theme = useThemeStyle();
    const dispatch = useDispatch<AppDispatch>();
    const unit = useSelector((s: RootState) => s.preferences.speedUnit);
    const weeklyGoalM = useSelector((s: RootState) => s.preferences.weeklyGoalM);
    const [trips, setTrips] = useState<HistoryTrip[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [view, setView] = useState<HistoryView>('list');
    const [monthMs, setMonthMs] = useState(() => dayStart(Date.now()));
    const [selectedDayMs, setSelectedDayMs] = useState<number | null>(() => dayStart(Date.now()));

    // The tab stays mounted, so reload each time it comes into view.
    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            loadHistory()
                .then(loaded => !cancelled && setTrips(loaded))
                .catch(err => !cancelled && setError(String(err)));
            return () => {
                cancelled = true;
            };
        }, []),
    );

    const totals = useMemo(() => historyTotals(trips ?? []), [trips]);
    const dayTrips = useMemo(() => (selectedDayMs === null ? [] : tripsOnDay(trips ?? [], selectedDayMs)), [trips, selectedDayMs]);

    const confirmDelete = (trip: HistoryTrip) =>
        Alert.alert('Delete this trip?', 'It will be removed from your history.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () =>
                    deleteTrip(trip.startedAt)
                        .then(() => setTrips(current => current?.filter(t => t.startedAt !== trip.startedAt) ?? null))
                        .catch(err => Alert.alert('Could not delete trip', String(err))),
            },
        ]);

    return (
        <View style={{ flex: 1, backgroundColor: theme.surfaceColor }}>
            <ScreenHeader
                title="History"
                right={!!trips?.length && (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Open heatmap"
                        hitSlop={8}
                        onPress={() => router.push('/heatmap')}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: theme.accentSoft }}
                    >
                        <MapIcon size={16} color={ACCENT} />
                        <Text style={{ color: ACCENT, fontSize: 14, fontWeight: '700' }}>Heatmap</Text>
                    </Pressable>
                )}
            />

            {error ? (
                <Text style={{ color: DANGER, padding: 24, textAlign: 'center' }}>Could not load your trips. {error}</Text>
            ) : !trips ? (
                <ActivityIndicator color={ACCENT} style={{ marginTop: 48 }} />
            ) : trips.length === 0 ? (
                <View style={{ alignItems: 'center', gap: 8, padding: 40 }}>
                    <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accentSoft, marginBottom: 4 }}>
                        <Footprints size={28} color={ACCENT} />
                    </View>
                    <Text style={{ color: theme.color, fontSize: 17, fontWeight: '700' }}>No trips yet</Text>
                    <Text style={{ color: theme.muted, fontSize: 14, textAlign: 'center' }}>
                        Start one from a route on the map and it will show up here.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={view === 'list' ? trips : dayTrips}
                    keyExtractor={trip => String(trip.startedAt)}
                    contentContainerStyle={{ padding: 24, paddingTop: 0, gap: 8 }}
                    ListHeaderComponent={
                        <View style={{ gap: 16, marginBottom: 8 }}>
                            <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} />
                            {view === 'list' ? (
                                <>
                                    <HistoryStats totals={totals} unit={unit} />
                                    <WalkingGoal trips={trips} goalM={weeklyGoalM} />
                                    <HistoryCharts trips={trips} unit={unit} />
                                </>
                            ) : (
                                <HistoryCalendar
                                    trips={trips}
                                    monthMs={monthMs}
                                    onMonthChange={setMonthMs}
                                    selectedDayMs={selectedDayMs}
                                    onSelectDay={setSelectedDayMs}
                                />
                            )}
                        </View>
                    }
                    ListEmptyComponent={view === 'calendar' ? (
                        <Text style={{ color: theme.muted, fontSize: 14, textAlign: 'center', padding: 24 }}>
                            No trips on this day.
                        </Text>
                    ) : null}
                    renderItem={({ item }) => (
                        <TripHistoryRow
                            trip={item}
                            onOpen={() => {
                                dispatch(viewTrip({ startedAt: item.startedAt, returnTo: 'history' }));
                                router.navigate('/');
                            }}
                            onDelete={() => confirmDelete(item)}
                        />
                    )}
                />
            )}
        </View>
    );
}
