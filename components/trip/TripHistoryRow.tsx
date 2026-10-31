import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Footprints, Trash2 } from 'lucide-react-native';
import { ACCENT, RADIUS, useThemeStyle } from '@/constants/themes';
import { formatDistance, tripTitle } from '@/services/trips/tripFormat';
import { rideCount, type HistoryTrip } from '@/services/trips/tripHistory';

export default function TripHistoryRow({ trip, onOpen, onDelete }: { trip: HistoryTrip; onOpen: () => void; onDelete: () => void }) {
    const theme = useThemeStyle();
    const rides = rideCount(trip);
    const when = new Date(trip.startedAt).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    const details = [
        when,
        trip.totals.distanceM > 0 ? formatDistance(trip.totals.distanceM) : null,
        rides > 0 ? `${rides} ${rides === 1 ? 'ride' : 'rides'}` : null,
    ].filter(Boolean);

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.tile, backgroundColor: theme.backgroundColor }}>
            <Pressable accessibilityRole="button" onPress={onOpen} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accentSoft }}>
                    <Footprints size={18} color={ACCENT} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                    <Text numberOfLines={1} style={{ color: theme.color, fontSize: 15, fontWeight: '600' }}>{tripTitle(trip.legs)}</Text>
                    <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 13 }}>{details.join(' · ')}</Text>
                </View>
            </Pressable>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete trip"
                onPress={onDelete}
                style={{ width: 48, height: 56, alignItems: 'center', justifyContent: 'center' }}
            >
                <Trash2 size={18} color={theme.muted} />
            </Pressable>
        </View>
    );
}
