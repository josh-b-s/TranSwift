import React from 'react';
import { Text, View } from 'react-native';
import { ACCENT, useThemeStyle } from '@/constants/themes';
import { walkingStreak, weekDistanceM } from '@/services/trips/periodTotals';
import { formatDistance } from '@/services/trips/tripFormat';
import type { HistoryTrip } from '@/services/trips/tripHistory';

/** The walking streak, and progress towards the weekly distance goal when one is set. */
export default function WalkingGoal({ trips, goalM }: { trips: HistoryTrip[]; goalM: number }) {
    const theme = useThemeStyle();
    const now = Date.now();
    const walkedM = weekDistanceM(trips, now);
    const streak = walkingStreak(trips, now);
    const caption = { color: theme.color, opacity: 0.5, fontSize: 12, fontWeight: '600' as const };

    return (
        <View style={{ borderRadius: 16, padding: 14, backgroundColor: theme.backgroundColor, gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Text style={caption}>Walking streak</Text>
                <Text style={{ color: theme.color, fontSize: 20, fontWeight: '700' }}>
                    {streak} {streak === 1 ? 'day' : 'days'}
                </Text>
            </View>
            {goalM > 0 && (
                <View style={{ gap: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={caption}>This week</Text>
                        <Text style={caption}>
                            {walkedM >= goalM ? 'Goal reached' : `${formatDistance(walkedM)} of ${formatDistance(goalM)}`}
                        </Text>
                    </View>
                    <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.color + '22', overflow: 'hidden' }}>
                        <View
                            accessible
                            accessibilityLabel={`${formatDistance(walkedM)} walked this week of a ${formatDistance(goalM)} goal`}
                            style={{ width: `${Math.min(100, (walkedM / goalM) * 100)}%`, height: 8, backgroundColor: ACCENT }}
                        />
                    </View>
                </View>
            )}
        </View>
    );
}
