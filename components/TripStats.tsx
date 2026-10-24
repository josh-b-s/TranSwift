import React from 'react';
import { Text, View } from 'react-native';
import { useThemeStyle } from '@/constants/themes';
import type { SpeedUnit } from '@/services/preferences/preferencesStore';
import { formatDistance, formatDuration, formatPace, formatSpeed } from '@/services/trips/tripFormat';
import type { TripSummary } from '@/services/trips/tripSummary';

export default function TripStats({ summary, unit }: { summary: TripSummary; unit: SpeedUnit }) {
    const theme = useThemeStyle();
    const tiles = [
        { label: 'Walked', value: summary.distanceM > 0 ? formatDistance(summary.distanceM) : '--' },
        { label: 'Walking time', value: summary.durationS > 0 ? formatDuration(summary.durationS) : '--' },
        { label: 'Average speed', value: formatSpeed(summary.avgSpeedMps, unit) },
        { label: 'Top speed', value: formatSpeed(summary.topSpeedMps, unit) },
        { label: 'Average pace', value: formatPace(summary.avgSpeedMps, unit) },
        { label: 'Rides', value: String(summary.rideCount) },
    ];

    return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {tiles.map(tile => (
                <View
                    key={tile.label}
                    style={{ width: '48%', borderRadius: 16, padding: 14, backgroundColor: theme.backgroundColor, gap: 2 }}
                >
                    <Text style={{ color: theme.color, opacity: 0.5, fontSize: 12, fontWeight: '600' }}>{tile.label}</Text>
                    <Text style={{ color: theme.color, fontSize: 20, fontWeight: '700' }}>{tile.value}</Text>
                </View>
            ))}
        </View>
    );
}
