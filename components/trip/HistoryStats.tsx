import React from 'react';
import { Text, View } from 'react-native';
import { useThemeStyle } from '@/constants/themes';
import type { SpeedUnit } from '@/services/preferences/preferencesStore';
import { formatDistance, formatDuration, formatPace, formatSpeed } from '@/services/trips/tripFormat';
import type { HistoryTotals } from '@/services/trips/tripHistory';

export default function HistoryStats({ totals, unit }: { totals: HistoryTotals; unit: SpeedUnit }) {
    const theme = useThemeStyle();
    const tiles = [
        { label: 'Trips', value: String(totals.tripCount) },
        { label: 'Rides', value: String(totals.rideCount) },
        { label: 'Walked', value: totals.distanceM > 0 ? formatDistance(totals.distanceM) : '--' },
        { label: 'Walking time', value: totals.durationS > 0 ? formatDuration(totals.durationS) : '--' },
        { label: 'Average speed', value: formatSpeed(totals.avgSpeedMps, unit) },
        { label: 'Average pace', value: formatPace(totals.avgSpeedMps, unit) },
        { label: 'Top speed', value: formatSpeed(totals.topSpeedMps, unit) },
        { label: 'Longest walk', value: totals.longestWalkM > 0 ? formatDistance(totals.longestWalkM) : '--' },
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
