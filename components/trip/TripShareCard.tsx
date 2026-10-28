import React, { forwardRef } from 'react';
import Svg, { Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { ACCENT } from '@/constants/themes';
import type { CardLine } from '@/services/trips/shareCard';
import { truncate } from '@/services/trips/shareCard';

// The card is a picture that gets shared, so it has its own fixed palette rather than following the app theme.
const BACKGROUND = '#0B2468';
const TEXT = '#FFFFFF';
const MUTED = '#FFFFFFA6';
const RIDE_FALLBACK = '#9AA9D6';

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;
/** The area the route is drawn in, so the caller can project into it. */
export const CARD_MAP = { x: 90, y: 400, width: 900, height: 620 };

const MAX_NAME_CHARS = 26;

type Props = {
    from: string;
    to: string;
    dateLabel: string;
    stats: { label: string; value: string }[];
    lines: CardLine[];
};

/** A 4:5 picture of the trip: where it went, the route, and the walking figures. Render it, then `toDataURL`. */
const TripShareCard = forwardRef<Svg, Props>(({ from, to, dateLabel, stats, lines }, ref) => {
    const columnWidth = (CARD_WIDTH - 180) / Math.max(1, stats.length);

    return (
        <Svg ref={ref} width="100%" style={{ aspectRatio: CARD_WIDTH / CARD_HEIGHT }} viewBox={`0 0 ${CARD_WIDTH} ${CARD_HEIGHT}`}>
            <Rect width={CARD_WIDTH} height={CARD_HEIGHT} fill={BACKGROUND} />
            <SvgText x={90} y={120} fill={MUTED} fontSize={36} fontWeight="700" letterSpacing={4}>TRANSWIFT</SvgText>
            <SvgText x={90} y={220} fill={TEXT} fontSize={64} fontWeight="700">{truncate(from, MAX_NAME_CHARS)}</SvgText>
            <SvgText x={90} y={295} fill={TEXT} fontSize={64}>{`to ${truncate(to, MAX_NAME_CHARS - 3)}`}</SvgText>
            <SvgText x={90} y={355} fill={MUTED} fontSize={34}>{dateLabel}</SvgText>

            {lines.map((line, i) => (
                <Polyline
                    key={i}
                    points={line.points}
                    transform={`translate(${CARD_MAP.x} ${CARD_MAP.y})`}
                    fill="none"
                    stroke={line.kind === 'walk' ? ACCENT : line.color ?? RIDE_FALLBACK}
                    strokeWidth={line.kind === 'walk' ? 10 : 8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            ))}

            {stats.map((stat, i) => (
                <React.Fragment key={stat.label}>
                    <SvgText x={90 + i * columnWidth} y={1140} fill={TEXT} fontSize={56} fontWeight="700">{stat.value}</SvgText>
                    <SvgText x={90 + i * columnWidth} y={1195} fill={MUTED} fontSize={28}>{stat.label}</SvgText>
                </React.Fragment>
            ))}
        </Svg>
    );
});

TripShareCard.displayName = 'TripShareCard';

export default TripShareCard;
