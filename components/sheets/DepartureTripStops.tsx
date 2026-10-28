import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { ACCENT, useThemeStyle } from '@/constants/themes';
import { useTripStops } from '@/hooks/tripStops';
import DepartureDelay from '@/components/sheets/DepartureDelay';
import { formatClock } from '@/services/gtfs/departures/departureFormat';
import type { Departure } from '@/services/gtfs/departures/stopDepartures';

/** Where one departure goes next, with the scheduled time at each stop. */
export default function DepartureTripStops({ departure }: { departure: Departure }) {
    const theme = useThemeStyle();
    const { stops, loading, error } = useTripStops(departure);

    if (loading) return <ActivityIndicator color={ACCENT} style={{ padding: 8 }} />;
    if (error) return <Text style={{ color: '#ef4444', fontSize: 13 }}>{error}</Text>;

    return (
        <View style={{ gap: 6, paddingTop: 6 }}>
            {stops.map((stop, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 3, borderColor: departure.routeColor }} />
                    <Text
                        numberOfLines={1}
                        style={{
                            flex: 1,
                            color: theme.color,
                            fontSize: 13,
                            fontWeight: i === 0 ? '700' : '400',
                            textDecorationLine: stop.skipped ? 'line-through' : 'none',
                        }}
                    >
                        {stop.stopName}
                    </Text>
                    {stop.skipped ? (
                        <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600' }}>Skipped</Text>
                    ) : (
                        <>
                            {stop.delaySec !== null && <DepartureDelay delaySec={stop.delaySec} />}
                            <Text style={{ color: theme.color, opacity: 0.6, fontSize: 13 }}>{formatClock(stop.liveTimeMs)}</Text>
                        </>
                    )}
                </View>
            ))}
        </View>
    );
}
