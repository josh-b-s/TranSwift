import React from 'react';
import { Text, View } from 'react-native';
import { Flame } from 'lucide-react-native';
import { ACCENT, RADIUS, SUCCESS, WARNING, useThemeStyle } from '@/constants/themes';
import { walkingStreak, weekDistanceM } from '@/services/trips/periodTotals';
import { formatDistance } from '@/services/trips/tripFormat';
import type { HistoryTrip } from '@/services/trips/tripHistory';

/** The walking streak, and progress towards the weekly distance goal when one is set. */
export default function WalkingGoal({ trips, goalM }: { trips: HistoryTrip[]; goalM: number }) {
    const theme = useThemeStyle();
    const now = Date.now();
    const walkedM = weekDistanceM(trips, now);
    const streak = walkingStreak(trips, now);
    const reached = goalM > 0 && walkedM >= goalM;
    const caption = { color: theme.muted, fontSize: 12, fontWeight: '600' as const };

    return (
        <View style={{ borderRadius: RADIUS.tile, padding: 14, backgroundColor: theme.backgroundColor, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                    style={{
                        width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: streak > 0 ? WARNING + '26' : theme.hairline,
                    }}
                >
                    <Flame size={20} color={streak > 0 ? WARNING : theme.muted} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={caption}>Walking streak</Text>
                    <Text style={{ color: theme.color, fontSize: 20, fontWeight: '700' }}>
                        {streak} {streak === 1 ? 'day' : 'days'}
                    </Text>
                </View>
            </View>
            {goalM > 0 && (
                <View style={{ gap: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={caption}>This week</Text>
                        <Text style={{ ...caption, color: reached ? SUCCESS : theme.muted }}>
                            {reached ? 'Goal reached' : `${formatDistance(walkedM)} of ${formatDistance(goalM)}`}
                        </Text>
                    </View>
                    <View style={{ height: 10, borderRadius: 5, backgroundColor: theme.hairline, overflow: 'hidden' }}>
                        <View
                            accessible
                            accessibilityLabel={`${formatDistance(walkedM)} walked this week of a ${formatDistance(goalM)} goal`}
                            style={{ width: `${Math.min(100, (walkedM / goalM) * 100)}%`, height: 10, borderRadius: 5, backgroundColor: reached ? SUCCESS : ACCENT }}
                        />
                    </View>
                </View>
            )}
        </View>
    );
}
