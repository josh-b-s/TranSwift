import React from 'react';
import { Text, View } from 'react-native';
import { ACCENT, useThemeStyle } from '@/constants/themes';
import type { SpeedUnit } from '@/services/preferences/preferencesStore';
import { formatPace, splitLengthM, splitUnitName } from '@/services/trips/tripFormat';
import type { Split } from '@/services/trips/tripSplits';

/** Pace for each kilometre or mile walked, with a bar that is longer for a faster split. */
export default function TripSplits({ splits, unit }: { splits: Split[]; unit: SpeedUnit }) {
    const theme = useThemeStyle();
    const fastest = Math.max(0, ...splits.map(s => s.avgSpeedMps));
    const lengthM = splitLengthM(unit);

    return (
        <View style={{ borderRadius: 16, padding: 14, backgroundColor: theme.backgroundColor, gap: 8 }}>
            <Text style={{ color: theme.color, fontSize: 14, fontWeight: '700' }}>Splits per {splitUnitName(unit)}</Text>
            {splits.map((split, i) => {
                const partial = split.distanceM < lengthM;
                return (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={{ width: 36, color: theme.color, opacity: 0.55, fontSize: 13 }}>
                            {partial ? (split.distanceM / lengthM).toFixed(2) : i + 1}
                        </Text>
                        <View style={{ flex: 1, height: 8, justifyContent: 'center' }}>
                            <View
                                style={{
                                    width: `${fastest > 0 ? (split.avgSpeedMps / fastest) * 100 : 0}%`,
                                    height: 8,
                                    borderRadius: 4,
                                    backgroundColor: ACCENT,
                                }}
                            />
                        </View>
                        <Text style={{ width: 92, textAlign: 'right', color: theme.color, fontSize: 13, fontWeight: '600' }}>
                            {formatPace(split.avgSpeedMps, unit)}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
}
