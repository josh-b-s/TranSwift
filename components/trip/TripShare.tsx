import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import type Svg from 'react-native-svg';
import { ACCENT, useThemeStyle } from '@/constants/themes';
import TripShareCard, { CARD_HEIGHT, CARD_MAP, CARD_WIDTH } from '@/components/trip/TripShareCard';
import type { SpeedUnit } from '@/services/preferences/preferencesStore';
import { projectLines } from '@/services/trips/shareCard';
import { shareTripCard, shareTripGpx } from '@/services/trips/shareTrip';
import { formatDistance, formatDuration, formatSpeed } from '@/services/trips/tripFormat';
import { tripLines } from '@/services/trips/tripLines';
import type { TripSummary } from '@/services/trips/tripSummary';
import type { SavedTrip } from '@/services/trips/tripStore';

type Props = { trip: SavedTrip; summary: TripSummary; unit: SpeedUnit };

/** The shareable trip card with buttons to share it as an image, or to export the trip as GPX. */
export default function TripShare({ trip, summary, unit }: Props) {
    const theme = useThemeStyle();
    const cardRef = useRef<Svg>(null);
    const [busy, setBusy] = useState(false);

    const lines = useMemo(() => projectLines(tripLines(trip), CARD_MAP.width, CARD_MAP.height), [trip]);
    const first = trip.legs[0];
    const last = trip.legs[trip.legs.length - 1];
    const stats = [
        { label: 'Walked', value: formatDistance(summary.distanceM) },
        { label: 'Walking time', value: formatDuration(summary.durationS) },
        { label: 'Avg speed', value: formatSpeed(summary.avgSpeedMps, unit) },
    ];

    const run = async (action: () => Promise<void>) => {
        setBusy(true);
        try {
            await action();
        } catch (err) {
            Alert.alert('Could not share', err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    };

    const shareImage = () =>
        run(
            () =>
                new Promise<void>((resolve, reject) => {
                    if (!cardRef.current) return reject(new Error('The card is not ready yet.'));
                    cardRef.current.toDataURL(png => shareTripCard(trip.startedAt, png).then(resolve, reject), {
                        width: CARD_WIDTH,
                        height: CARD_HEIGHT,
                    });
                }),
        );

    const buttonStyle = (primary: boolean) => ({
        flex: 1,
        alignItems: 'center' as const,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: primary ? ACCENT : theme.backgroundColor,
        opacity: busy ? 0.5 : 1,
    });

    return (
        <View style={{ gap: 12 }}>
            <View style={{ borderRadius: 16, overflow: 'hidden' }}>
                <TripShareCard
                    ref={cardRef}
                    from={first?.from ?? 'Trip'}
                    to={last?.to ?? ''}
                    dateLabel={new Date(trip.startedAt).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    stats={stats}
                    lines={lines}
                />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable accessibilityRole="button" disabled={busy} onPress={shareImage} style={buttonStyle(true)}>
                    {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Share image</Text>}
                </Pressable>
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => run(() => shareTripGpx(trip))} style={buttonStyle(false)}>
                    <Text style={{ color: theme.color, fontWeight: '700' }}>Export GPX</Text>
                </Pressable>
            </View>
        </View>
    );
}
