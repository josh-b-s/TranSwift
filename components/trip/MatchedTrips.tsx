import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ACCENT, useThemeStyle } from '@/constants/themes';
import type { SpeedUnit } from '@/services/preferences/preferencesStore';
import { formatDuration, formatSpeed } from '@/services/trips/tripFormat';
import type { TripMatches } from '@/services/trips/matchedTrips';

const MAX_ROWS = 6;

/** Earlier runs of the same journey, with the current one marked and the fastest tagged. */
export default function MatchedTrips({ matches, currentStartedAt, unit }: { matches: TripMatches; currentStartedAt: number; unit: SpeedUnit }) {
    const theme = useThemeStyle();
    if (matches.runs.length < 2) return null;

    return (
        <View style={{ borderRadius: 16, padding: 14, backgroundColor: theme.backgroundColor, gap: 8 }}>
            <Text style={{ color: theme.color, fontSize: 14, fontWeight: '700' }}>Same trip, {matches.runs.length} times</Text>
            {matches.runs.slice(0, MAX_ROWS).map(({ trip, avgSpeedMps }) => {
                const current = trip.startedAt === currentStartedAt;
                const date = new Date(trip.startedAt).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
                return (
                    <Pressable
                        key={trip.startedAt}
                        accessibilityRole="button"
                        disabled={current}
                        onPress={() => router.push(`/trip/${trip.startedAt}`)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                    >
                        <Text style={{ flex: 1, color: current ? ACCENT : theme.color, fontSize: 13, fontWeight: current ? '700' : '400' }}>
                            {date}{trip.startedAt === matches.fastestStartedAt ? ' · fastest' : ''}
                        </Text>
                        <Text style={{ color: theme.color, opacity: 0.7, fontSize: 13 }}>
                            {trip.totals.durationS > 0 ? `${formatDuration(trip.totals.durationS)} · ${formatSpeed(avgSpeedMps, unit)}` : 'No walking'}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}
