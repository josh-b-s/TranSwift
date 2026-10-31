import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Trophy } from 'lucide-react-native';
import MapView, { Polyline } from 'react-native-maps';
import { router, useLocalSearchParams } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootState } from '@/store/store';
import { ACCENT, DANGER, RADIUS, SUCCESS, TOP_SAFE, useThemeStyle } from '@/constants/themes';
import { SPEED_UNITS } from '@/constants/speedUnits';
import TripStats from '@/components/trip/TripStats';
import TripLegList from '@/components/trip/TripLegList';
import TripBarChart from '@/components/trip/TripBarChart';
import TripSplits from '@/components/trip/TripSplits';
import MatchedTrips from '@/components/trip/MatchedTrips';
import TripShare from '@/components/trip/TripShare';
import { loadTrip, type SavedTrip } from '@/services/trips/tripStore';
import { summarizeTrip, walkPaths } from '@/services/trips/tripSummary';
import { walkSplits } from '@/services/trips/tripSplits';
import { speedProfile } from '@/services/trips/speedProfile';
import { loadHistory, type HistoryTrip } from '@/services/trips/tripHistory';
import { matchTrips } from '@/services/trips/matchedTrips';
import { tripLines } from '@/services/trips/tripLines';
import { formatDuration, formatSpeed, recordLines, splitLengthM } from '@/services/trips/tripFormat';

const SPEED_BARS = 40;

export default function TripSummaryScreen() {
    const { startedAt } = useLocalSearchParams<{ startedAt: string }>();
    const theme = useThemeStyle();
    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const unit = useSelector((s: RootState) => s.preferences.speedUnit);
    const mapRef = useRef<MapView>(null);
    const [trip, setTrip] = useState<SavedTrip | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [history, setHistory] = useState<HistoryTrip[]>([]);

    useEffect(() => {
        loadTrip(Number(startedAt)).then(setTrip).catch(err => setError(String(err)));
    }, [startedAt]);

    useEffect(() => {
        loadHistory().then(setHistory).catch(err => console.warn('[trip] could not load history for matches:', err));
    }, [startedAt]);

    const summary = useMemo(() => (trip ? summarizeTrip(trip) : null), [trip]);
    const lines = useMemo(() => (trip ? tripLines(trip) : []), [trip]);
    const records = useMemo(() => (trip ? recordLines(trip.records, unit) : []), [trip, unit]);
    const splits = useMemo(() => (trip ? walkSplits(walkPaths(trip), splitLengthM(unit)) : []), [trip, unit]);
    const speeds = useMemo(() => (trip ? speedProfile(walkPaths(trip), SPEED_BARS) : []), [trip]);
    const matches = useMemo(() => {
        const current = history.find(t => t.startedAt === trip?.startedAt);
        return current ? matchTrips(history, current) : null;
    }, [history, trip]);
    const newBestKeys = useMemo(
        () => new Set((trip?.records ?? []).flatMap(r => (r.kind === 'speed' ? [`${r.from}>${r.to}`] : []))),
        [trip],
    );

    const fitMap = () => {
        const coords = lines.flatMap(line => line.coords);
        if (coords.length === 0) return;
        mapRef.current?.fitToCoordinates(coords, {
            edgePadding: { top: 60, right: 40, bottom: 60, left: 40 },
            animated: false,
        });
    };

    return (
        <View style={{ flex: 1, backgroundColor: theme.surfaceColor }}>
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: TOP_SAFE(insets),
                    paddingHorizontal: 24,
                    paddingBottom: 12,
                }}
            >
                <View>
                    <Text style={{ color: theme.color, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>Trip complete</Text>
                    {trip && (
                        <Text style={{ color: theme.muted, fontSize: 13 }}>
                            {new Date(trip.startedAt).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                        </Text>
                    )}
                </View>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Done"
                    hitSlop={8}
                    onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
                    style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, backgroundColor: ACCENT }}
                >
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Done</Text>
                </Pressable>
            </View>

            {error ? (
                <Text style={{ color: DANGER, padding: 24, textAlign: 'center' }}>Could not open this trip. {error}</Text>
            ) : !trip || !summary ? (
                <ActivityIndicator color={ACCENT} style={{ marginTop: 48 }} />
            ) : (
                <>
                    {lines.some(line => line.coords.length > 0) && (
                        <View style={{ flex: 1, marginHorizontal: 24, marginBottom: 12, borderRadius: RADIUS.card + 4, overflow: 'hidden' }}>
                        <MapView
                            ref={mapRef}
                            key={colorScheme}
                            style={{ flex: 1 }}
                            showsCompass={false}
                            userInterfaceStyle={colorScheme ?? 'light'}
                            onMapReady={fitMap}
                        >
                            {lines.map((line, i) => (
                                <Polyline
                                    key={i}
                                    coordinates={line.coords}
                                    strokeWidth={line.kind === 'walk' ? 5 : 4}
                                    strokeColor={line.kind === 'walk' ? ACCENT : line.color ?? '#666666'}
                                    lineCap="round"
                                    lineJoin="round"
                                />
                            ))}
                        </MapView>
                        </View>
                    )}
                    <ScrollView style={{ flex: 1.4 }} contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 24, gap: 16 }}>
                        <TripStats summary={summary} unit={unit} />
                        {records.length > 0 && (
                            <View style={{ borderRadius: RADIUS.tile, padding: 14, backgroundColor: theme.backgroundColor, gap: 8 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Trophy size={18} color={SUCCESS} />
                                    <Text style={{ color: theme.color, fontSize: 15, fontWeight: '700' }}>New records</Text>
                                </View>
                                {records.map(line => (
                                    <Text key={line} style={{ color: theme.color, fontSize: 14 }}>{line}</Text>
                                ))}
                            </View>
                        )}
                        {speeds.length > 0 && summary && (
                            <TripBarChart
                                title={`Walking speed (${SPEED_UNITS[unit].label})`}
                                values={speeds}
                                peakLabel={formatSpeed(Math.max(...speeds), unit)}
                                startLabel="Start"
                                endLabel={formatDuration(summary.durationS)}
                            />
                        )}
                        {splits.length > 0 && <TripSplits splits={splits} unit={unit} />}
                        {matches && <MatchedTrips matches={matches} currentStartedAt={trip.startedAt} unit={unit} />}
                        <TripLegList legs={summary.legs} newBestKeys={newBestKeys} unit={unit} />
                        <TripShare trip={trip} summary={summary} unit={unit} />
                    </ScrollView>
                </>
            )}
        </View>
    );
}
