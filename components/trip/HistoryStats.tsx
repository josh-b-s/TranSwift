import React from 'react';
import StatGrid from '@/components/ui/StatGrid';
import type { SpeedUnit } from '@/services/preferences/preferencesStore';
import { formatDistance, formatDuration, formatPace, formatSpeed } from '@/services/trips/tripFormat';
import type { HistoryTotals } from '@/services/trips/tripHistory';

export default function HistoryStats({ totals, unit }: { totals: HistoryTotals; unit: SpeedUnit }) {
    return (
        <StatGrid
            hero={{ label: 'Total walked', value: totals.distanceM > 0 ? formatDistance(totals.distanceM) : '--' }}
            stats={[
                { label: 'Trips', value: String(totals.tripCount) },
                { label: 'Rides', value: String(totals.rideCount) },
                { label: 'Walking time', value: totals.durationS > 0 ? formatDuration(totals.durationS) : '--' },
                { label: 'Longest walk', value: totals.longestWalkM > 0 ? formatDistance(totals.longestWalkM) : '--' },
                { label: 'Average speed', value: formatSpeed(totals.avgSpeedMps, unit) },
                { label: 'Average pace', value: formatPace(totals.avgSpeedMps, unit) },
                { label: 'Top speed', value: formatSpeed(totals.topSpeedMps, unit) },
            ]}
        />
    );
}
