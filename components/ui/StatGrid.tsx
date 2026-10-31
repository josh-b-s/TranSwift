import React from 'react';
import { Text, View } from 'react-native';
import { ACCENT, RADIUS, useThemeStyle } from '@/constants/themes';

export type Stat = { label: string; value: string };

/** One headline figure on an accent card, then the rest as a two-column grid of tiles. */
export default function StatGrid({ hero, stats }: { hero: Stat; stats: Stat[] }) {
    const theme = useThemeStyle();

    return (
        <View style={{ gap: 10 }}>
            <View style={{ borderRadius: RADIUS.card, padding: 18, backgroundColor: ACCENT, gap: 2 }}>
                <Text style={{ color: '#ffffffcc', fontSize: 13, fontWeight: '600' }}>{hero.label}</Text>
                <Text style={{ color: '#ffffff', fontSize: 36, fontWeight: '800', letterSpacing: -0.5 }}>{hero.value}</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {stats.map(stat => (
                    <View
                        key={stat.label}
                        style={{
                            flexGrow: 1,
                            flexBasis: '45%',
                            borderRadius: RADIUS.tile,
                            padding: 14,
                            backgroundColor: theme.backgroundColor,
                            gap: 2,
                        }}
                    >
                        <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '600' }}>{stat.label}</Text>
                        <Text style={{ color: theme.color, fontSize: 20, fontWeight: '700' }}>{stat.value}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}
