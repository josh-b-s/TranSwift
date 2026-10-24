import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { router, useLocalSearchParams } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootState } from '@/store/store';
import { ACCENT, MAP_STYLE_DARK, TOP_SAFE, useThemeStyle } from '@/constants/themes';
import TripStats from '@/components/TripStats';
import TripLegList from '@/components/TripLegList';
import { loadTrip, type SavedTrip } from '@/services/trips/tripStore';
import { summarizeTrip } from '@/services/trips/tripSummary';
import { tripLines } from '@/services/trips/tripLines';
import { recordLines } from '@/services/trips/tripFormat';

export default function TripSummaryScreen() {
    const { startedAt } = useLocalSearchParams<{ startedAt: string }>();
    const theme = useThemeStyle();
    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const unit = useSelector((s: RootState) => s.preferences.speedUnit);
    const mapRef = useRef<MapView>(null);
    const [trip, setTrip] = useState<SavedTrip | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadTrip(Number(startedAt)).then(setTrip).catch(err => setError(String(err)));
    }, [startedAt]);

    const summary = useMemo(() => (trip ? summarizeTrip(trip) : null), [trip]);
    const lines = useMemo(() => (trip ? tripLines(trip) : []), [trip]);
    const records = useMemo(() => (trip ? recordLines(trip.records, unit) : []), [trip, unit]);
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
                    <Text style={{ color: theme.color, fontSize: 22, fontWeight: '700' }}>Trip complete</Text>
                    {trip && (
                        <Text style={{ color: theme.color, opacity: 0.5, fontSize: 13 }}>
                            {new Date(trip.startedAt).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                        </Text>
                    )}
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Done" hitSlop={8} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
                    <Text style={{ color: ACCENT, fontSize: 16, fontWeight: '700' }}>Done</Text>
                </Pressable>
            </View>

            {error ? (
                <Text style={{ color: '#ef4444', padding: 24, textAlign: 'center' }}>Could not open this trip. {error}</Text>
            ) : !trip || !summary ? (
                <ActivityIndicator color={ACCENT} style={{ marginTop: 48 }} />
            ) : (
                <>
                    {lines.some(line => line.coords.length > 0) && (
                        <MapView
                            ref={mapRef}
                            key={colorScheme}
                            style={{ flex: 1 }}
                            showsCompass={false}
                            userInterfaceStyle={colorScheme ?? 'light'}
                            customMapStyle={colorScheme === 'dark' ? MAP_STYLE_DARK : []}
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
                    )}
                    <ScrollView style={{ flex: 1.4 }} contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 24, gap: 16 }}>
                        <TripStats summary={summary} unit={unit} />
                        {records.length > 0 && (
                            <View style={{ borderRadius: 16, padding: 14, backgroundColor: theme.backgroundColor, gap: 6 }}>
                                <Text style={{ color: theme.color, fontSize: 14, fontWeight: '700' }}>Records</Text>
                                {records.map(line => (
                                    <Text key={line} style={{ color: theme.color, fontSize: 13 }}>{line}</Text>
                                ))}
                            </View>
                        )}
                        <TripLegList legs={summary.legs} newBestKeys={newBestKeys} unit={unit} />
                    </ScrollView>
                </>
            )}
        </View>
    );
}
