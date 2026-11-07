import React, { useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import { ACCENT, RADIUS, useThemeStyle } from '@/constants/themes';
import { SPEED_UNITS } from '@/constants/speedUnits';
import type { SpeedUnit } from '@/services/preferences/preferencesStore';
import { formatDuration, formatSpeed } from '@/services/trips/tripFormat';
import { pointAt, type TrackPoint } from '@/services/trips/speedTrack';

const GRAPH_HEIGHT = 96;
const SLIDER_HEIGHT = 32;
const THUMB_SIZE = 22;
const TRACK_HEIGHT = 4;

type Props = {
    track: TrackPoint[];
    unit: SpeedUnit;
    /** Slider position from 0 to 1, or null before it is touched. */
    fraction: number | null;
    onChange: (fraction: number) => void;
};

/** Walking speed over time as a line graph, with a slider right under it that picks a moment of the walk. */
export default function SpeedScrubber({ track, unit, fraction, onChange }: Props) {
    const theme = useThemeStyle();
    const [width, setWidth] = useState(0);
    const peak = Math.max(...track.map(p => p.mps));
    const chosen = fraction === null ? null : pointAt(track, fraction);

    const x = (i: number) => (i / (track.length - 1)) * width;
    const y = (mps: number) => GRAPH_HEIGHT - (peak > 0 ? (mps / peak) * (GRAPH_HEIGHT - 4) : 0) - 2;
    const line = track.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.mps).toFixed(1)}`).join(' ');

    const choose = (pointerX: number) => width > 0 && onChange(Math.min(1, Math.max(0, pointerX / width)));
    const gesture = Gesture.Race(
        // Mostly vertical drags stay with the sheet's scrolling.
        Gesture.Pan().runOnJS(true).activeOffsetX([-4, 4]).failOffsetY([-12, 12]).onUpdate(e => choose(e.x)),
        Gesture.Tap().runOnJS(true).onEnd(e => choose(e.x)),
    );
    const thumbLeft = (fraction ?? 0) * (width - THUMB_SIZE);

    return (
        <View style={{ borderRadius: RADIUS.tile, overflow: 'hidden', backgroundColor: theme.backgroundColor }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 14, paddingBottom: 6 }}>
                <Text style={{ color: theme.color, fontSize: 14, fontWeight: '700' }}>Walking speed ({SPEED_UNITS[unit].label})</Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>
                    {chosen ? `${formatDuration(chosen.atS)}, ${formatSpeed(chosen.mps, unit)}` : `Peak ${formatSpeed(peak, unit)}`}
                </Text>
            </View>
            <View
                onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
                accessible
                accessibilityLabel={`Walking speed graph, peak ${formatSpeed(peak, unit)}`}
                style={{ height: GRAPH_HEIGHT }}
            >
                {width > 0 && (
                    <Svg width={width} height={GRAPH_HEIGHT}>
                        <Path d={`${line} L${width} ${GRAPH_HEIGHT} L0 ${GRAPH_HEIGHT} Z`} fill={ACCENT + '33'} />
                        <Path d={line} stroke={ACCENT} strokeWidth={2} fill="none" strokeLinejoin="round" />
                    </Svg>
                )}
            </View>
            <GestureDetector gesture={gesture}>
                <View
                    accessible
                    accessibilityRole="adjustable"
                    accessibilityLabel="Moment of the walk"
                    accessibilityValue={{ min: 0, max: 100, now: Math.round((fraction ?? 0) * 100) }}
                    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                    onAccessibilityAction={e => onChange(Math.min(1, Math.max(0, (fraction ?? 0) + (e.nativeEvent.actionName === 'increment' ? 0.05 : -0.05))))}
                    style={{ height: SLIDER_HEIGHT, justifyContent: 'center' }}
                >
                    <View style={{ height: TRACK_HEIGHT, marginHorizontal: THUMB_SIZE / 2, borderRadius: TRACK_HEIGHT / 2, backgroundColor: theme.color + '22' }} />
                    <View
                        style={{
                            position: 'absolute',
                            left: thumbLeft,
                            width: THUMB_SIZE,
                            height: THUMB_SIZE,
                            borderRadius: THUMB_SIZE / 2,
                            backgroundColor: ACCENT,
                            borderWidth: 3,
                            borderColor: '#ffffff',
                        }}
                    />
                </View>
            </GestureDetector>
        </View>
    );
}
