import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import SegmentedControl from '@/components/ui/SegmentedControl';
import TripBarChart from '@/components/trip/TripBarChart';
import { SPEED_UNITS } from '@/constants/speedUnits';
import type { SpeedUnit } from '@/services/preferences/preferencesStore';
import { chartPoints, type HistoryChartMode } from '@/services/trips/periodTotals';
import { formatChartLabel, formatDistance, formatSpeed } from '@/services/trips/tripFormat';
import type { HistoryTrip } from '@/services/trips/tripHistory';

const MODE_OPTIONS: { value: HistoryChartMode; label: string }[] = [
    { value: 'trips', label: 'Trips' },
    { value: 'weeks', label: 'Weeks' },
    { value: 'months', label: 'Months' },
];

const PER: Record<HistoryChartMode, string> = { trips: '', weeks: ' per week', months: ' per month' };

/** Distance and average speed charts, by trip, week or month. */
export default function HistoryCharts({ trips, unit }: { trips: HistoryTrip[]; unit: SpeedUnit }) {
    const [mode, setMode] = useState<HistoryChartMode>('trips');
    const points = useMemo(() => chartPoints(trips, mode, Date.now()), [trips, mode]);

    const distances = points.map(p => p.distanceM);
    const speeds = points.map(p => (p.durationS > 0 ? p.distanceM / p.durationS : 0));
    const startLabel = points.length > 0 ? formatChartLabel(points[0].startMs, mode) : '';
    const endLabel = points.length > 0 ? formatChartLabel(points[points.length - 1].startMs, mode) : '';

    return (
        <View style={{ gap: 16 }}>
            <SegmentedControl options={MODE_OPTIONS} value={mode} onChange={setMode} />
            {points.length > 0 && (
                <>
                    <TripBarChart
                        title={`Distance walked${PER[mode]}`}
                        values={distances}
                        peakLabel={formatDistance(Math.max(0, ...distances))}
                        startLabel={startLabel}
                        endLabel={endLabel}
                    />
                    <TripBarChart
                        title={`Average speed${PER[mode]} (${SPEED_UNITS[unit].label})`}
                        values={speeds}
                        peakLabel={formatSpeed(Math.max(0, ...speeds), unit)}
                        startLabel={startLabel}
                        endLabel={endLabel}
                    />
                </>
            )}
        </View>
    );
}
