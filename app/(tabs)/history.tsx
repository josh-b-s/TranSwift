import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootState } from '@/store/store';
import { ACCENT, TOP_SAFE, useThemeStyle } from '@/constants/themes';
import { SPEED_UNITS } from '@/constants/speedUnits';
import HistoryStats from '@/components/trip/HistoryStats';
import TripBarChart from '@/components/trip/TripBarChart';
import TripHistoryRow from '@/components/trip/TripHistoryRow';
import { deleteTrip } from '@/services/trips/tripStore';
import { avgSpeedMps, historyTotals, loadHistory, type HistoryTrip } from '@/services/trips/tripHistory';
import { formatDistance, formatSpeed } from '@/services/trips/tripFormat';

const CHART_TRIPS = 14;

export default function HistoryScreen() {
    const theme = useThemeStyle();
    const insets = useSafeAreaInsets();
    const unit = useSelector((s: RootState) => s.preferences.speedUnit);
    const [trips, setTrips] = useState<HistoryTrip[] | null>(null);
    const [error, setError] = useState<string | null>(null);

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
    // Oldest first, so the charts read left to right. Trips with no walking have no speed to plot.
    const charted = useMemo(
        () => (trips ?? []).filter(t => t.totals.distanceM > 0).slice(0, CHART_TRIPS).reverse(),
        [trips],
    );
    const chartPeak = (pick: (t: HistoryTrip) => number) => Math.max(0, ...charted.map(pick));

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

    const charts = charted.length > 0 && (
        <>
            <TripBarChart
                title="Distance walked"
                values={charted.map(t => t.totals.distanceM)}
                peakLabel={formatDistance(chartPeak(t => t.totals.distanceM))}
                from={charted[0].startedAt}
                to={charted[charted.length - 1].startedAt}
            />
            <TripBarChart
                title={`Average speed (${SPEED_UNITS[unit].label})`}
                values={charted.map(t => avgSpeedMps(t.totals))}
                peakLabel={formatSpeed(chartPeak(t => avgSpeedMps(t.totals)), unit)}
                from={charted[0].startedAt}
                to={charted[charted.length - 1].startedAt}
            />
        </>
    );

    return (
        <View style={{ flex: 1, backgroundColor: theme.surfaceColor }}>
            <Text style={{ color: theme.color, fontSize: 22, fontWeight: '700', paddingTop: TOP_SAFE(insets), paddingHorizontal: 24, paddingBottom: 12 }}>
                History
            </Text>

            {error ? (
                <Text style={{ color: '#ef4444', padding: 24, textAlign: 'center' }}>Could not load your trips. {error}</Text>
            ) : !trips ? (
                <ActivityIndicator color={ACCENT} style={{ marginTop: 48 }} />
            ) : trips.length === 0 ? (
                <Text style={{ color: theme.color, opacity: 0.5, padding: 24, textAlign: 'center' }}>
                    No trips yet. Start one from a route on the map and it will show up here.
                </Text>
            ) : (
                <FlatList
                    data={trips}
                    keyExtractor={trip => String(trip.startedAt)}
                    contentContainerStyle={{ padding: 24, paddingTop: 0, gap: 8 }}
                    ListHeaderComponent={
                        <View style={{ gap: 16, marginBottom: 8 }}>
                            <HistoryStats totals={totals} unit={unit} />
                            {charts}
                        </View>
                    }
                    renderItem={({ item }) => (
                        <TripHistoryRow
                            trip={item}
                            onOpen={() => router.push(`/trip/${item.startedAt}`)}
                            onDelete={() => confirmDelete(item)}
                        />
                    )}
                />
            )}
        </View>
    );
}
