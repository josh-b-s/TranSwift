import React from 'react';
import { Text, View } from 'react-native';
import { Footprints } from 'lucide-react-native';
import { ACCENT, useThemeStyle } from '@/constants/themes';
import type { SpeedUnit } from '@/services/preferences/preferencesStore';
import { formatDistance, formatDuration, formatSpeed } from '@/services/trips/tripFormat';
import type { LegSummary } from '@/services/trips/tripSummary';

type Props = { legs: LegSummary[]; newBestKeys: Set<string>; unit: SpeedUnit };

export default function TripLegList({ legs, newBestKeys, unit }: Props) {
    const theme = useThemeStyle();
    const rowStyle = {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 10,
        borderRadius: 16,
        padding: 14,
        backgroundColor: theme.backgroundColor,
    };

    return (
        <View style={{ gap: 8 }}>
            {legs.map(item => {
                if (item.kind === 'ride') {
                    const { leg } = item;
                    return (
                        <View key={leg.stepIndex} style={rowStyle}>
                            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: leg.routeColor ?? ACCENT }}>
                                <Text style={{ color: leg.routeTextColor ?? '#fff', fontSize: 13, fontWeight: '700' }}>{leg.routeName}</Text>
                            </View>
                            <Text numberOfLines={1} style={{ flex: 1, color: theme.color, fontSize: 14 }}>
                                {leg.from} to {leg.to}
                            </Text>
                        </View>
                    );
                }

                const { leg, stats } = item;
                const isNewBest = leg.bestKey !== undefined && newBestKeys.has(leg.bestKey);
                return (
                    <View key={leg.stepIndex} style={rowStyle}>
                        <Footprints size={18} color={theme.color} />
                        <View style={{ flex: 1, gap: 2 }}>
                            <Text numberOfLines={1} style={{ color: theme.color, fontSize: 14 }}>{leg.from} to {leg.to}</Text>
                            <Text style={{ color: theme.color, opacity: 0.6, fontSize: 12 }}>
                                {formatDistance(stats.distanceM)} · {formatDuration(stats.durationS)} · {formatSpeed(stats.avgSpeedMps, unit)}
                            </Text>
                        </View>
                        {isNewBest && <Text style={{ color: ACCENT, fontSize: 12, fontWeight: '700' }}>New best</Text>}
                    </View>
                );
            })}
        </View>
    );
}
