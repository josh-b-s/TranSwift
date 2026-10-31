import React from 'react';
import StatGrid from '@/components/ui/StatGrid';
import type { SpeedUnit } from '@/services/preferences/preferencesStore';
import { formatDistance, formatDuration, formatPace, formatSpeed } from '@/services/trips/tripFormat';
import type { TripSummary } from '@/services/trips/tripSummary';

export default function TripStats({ summary, unit }: { summary: TripSummary; unit: SpeedUnit }) {
    return (
        <StatGrid
            hero={{ label: 'Walked', value: summary.distanceM > 0 ? formatDistance(summary.distanceM) : '--' }}
            stats={[
                { label: 'Walking time', value: summary.durationS > 0 ? formatDuration(summary.durationS) : '--' },
                { label: 'Rides', value: String(summary.rideCount) },
                { label: 'Average speed', value: formatSpeed(summary.avgSpeedMps, unit) },
                { label: 'Top speed', value: formatSpeed(summary.topSpeedMps, unit) },
                { label: 'Average pace', value: formatPace(summary.avgSpeedMps, unit) },
            ]}
        />
    );
}
