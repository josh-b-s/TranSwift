import React from 'react';
import { Polyline } from 'react-native-maps';
import { ACCENT } from '@/constants/themes';
import { RIDE_LINE_WIDTH } from '@/components/map/RideStopMarkers';
import { darken } from '@/services/color/darken';
import type { MapLine } from '@/services/trips/tripLines';

// How much darker than the route colour its outline is.
const CASING_DARKEN = 0.4;
const FALLBACK_RIDE_COLOR = '#666666';

/** A trip's walks and rides drawn the way the map draws a planned route: rides outlined in a darker shade, walks dashed. */
export default function RouteLines({ lines }: { lines: MapLine[] }) {
    return (
        <>
            {lines.map((line, i) => line.kind === 'ride' && (
                <Polyline
                    key={`casing-${i}`}
                    coordinates={line.coords}
                    strokeWidth={RIDE_LINE_WIDTH + 4}
                    strokeColor={darken(line.color ?? FALLBACK_RIDE_COLOR, CASING_DARKEN)}
                    lineCap="round"
                    lineJoin="round"
                    geodesic={false}
                />
            ))}
            {lines.map((line, i) => (
                <Polyline
                    key={i}
                    coordinates={line.coords}
                    strokeWidth={line.kind === 'walk' ? 4 : RIDE_LINE_WIDTH}
                    strokeColor={line.kind === 'walk' ? ACCENT : line.color ?? FALLBACK_RIDE_COLOR}
                    lineDashPattern={line.kind === 'walk' ? [8, 8] : undefined}
                    lineCap="round"
                    lineJoin="round"
                    geodesic={false}
                />
            ))}
        </>
    );
}
