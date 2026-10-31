import React from 'react';
import { Text, View } from 'react-native';
import { ACCENT, RADIUS, useThemeStyle } from '@/constants/themes';

const BAR_AREA_HEIGHT = 96;

type Props = {
    title: string;
    /** One bar per trip or period, oldest first. */
    values: number[];
    /** The tallest bar's value, already formatted. */
    peakLabel: string;
    /** Captions under the first and last bar. */
    startLabel: string;
    endLabel: string;
};

export default function TripBarChart({ title, values, peakLabel, startLabel, endLabel }: Props) {
    const theme = useThemeStyle();
    const peak = Math.max(0, ...values);
    const caption = { color: theme.muted, fontSize: 12 };

    return (
        <View style={{ borderRadius: RADIUS.tile, padding: 14, backgroundColor: theme.backgroundColor, gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.color, fontSize: 14, fontWeight: '700' }}>{title}</Text>
                <Text style={caption}>Peak {peakLabel}</Text>
            </View>
            <View
                accessible
                accessibilityLabel={`${title}, ${values.length} bars, peak ${peakLabel}`}
                style={{ height: BAR_AREA_HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}
            >
                {values.map((value, i) => (
                    <View
                        key={i}
                        style={{
                            flex: 1,
                            height: peak > 0 ? Math.max(3, (value / peak) * BAR_AREA_HEIGHT) : 3,
                            borderTopLeftRadius: 4,
                            borderTopRightRadius: 4,
                            borderBottomLeftRadius: 1,
                            borderBottomRightRadius: 1,
                            // The newest bar stands out; the rest read as history.
                            backgroundColor: i === values.length - 1 ? ACCENT : ACCENT + '66',
                        }}
                    />
                ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={caption}>{startLabel}</Text>
                {values.length > 1 && <Text style={caption}>{endLabel}</Text>}
            </View>
        </View>
    );
}
