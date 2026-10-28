import React, { useMemo, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { router } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ACCENT, MAP_STYLE_DARK, TOP_SAFE, useThemeStyle } from '@/constants/themes';
import { heatmapLines } from '@/services/trips/heatmap';
import { listTrips, type SavedTrip } from '@/services/trips/tripStore';

// Translucent, so paths walked more often draw darker where they overlap.
const LINE_COLOR = ACCENT + '55';

export default function HeatmapScreen() {
    const theme = useThemeStyle();
    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const mapRef = useRef<MapView>(null);
    const [trips, setTrips] = React.useState<SavedTrip[] | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        listTrips().then(setTrips).catch(err => setError(String(err)));
    }, []);

    const lines = useMemo(() => heatmapLines(trips ?? []), [trips]);

    const fitMap = () => {
        const coords = lines.flat();
        if (coords.length === 0) return;
        mapRef.current?.fitToCoordinates(coords, {
            edgePadding: { top: 120, right: 40, bottom: 60, left: 40 },
            animated: false,
        });
    };

    return (
        <View style={{ flex: 1, backgroundColor: theme.surfaceColor }}>
            {lines.length > 0 && (
                <MapView
                    ref={mapRef}
                    key={colorScheme}
                    style={{ flex: 1 }}
                    showsCompass={false}
                    userInterfaceStyle={colorScheme ?? 'light'}
                    customMapStyle={colorScheme === 'dark' ? MAP_STYLE_DARK : undefined}
                    onMapReady={fitMap}
                >
                    {lines.map((coordinates, i) => (
                        <Polyline key={i} coordinates={coordinates} strokeWidth={5} strokeColor={LINE_COLOR} lineCap="round" lineJoin="round" />
                    ))}
                </MapView>
            )}
            <View
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: TOP_SAFE(insets),
                    paddingHorizontal: 24,
                    paddingBottom: 12,
                    backgroundColor: theme.surfaceColor,
                }}
            >
                <Text style={{ color: theme.color, fontSize: 22, fontWeight: '700' }}>Heatmap</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Done" hitSlop={8} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
                    <Text style={{ color: ACCENT, fontSize: 16, fontWeight: '700' }}>Done</Text>
                </Pressable>
            </View>
            {(error || (trips && lines.length === 0)) && (
                <Text style={{ color: error ? '#ef4444' : theme.color, opacity: error ? 1 : 0.5, padding: 24, textAlign: 'center', marginTop: 120 }}>
                    {error ? `Could not load your trips. ${error}` : 'No recorded walks yet.'}
                </Text>
            )}
        </View>
    );
}
