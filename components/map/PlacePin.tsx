import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { DANGER, SUCCESS } from '@/constants/themes';

export const ORIGIN_PIN_COLOR = SUCCESS;
export const DESTINATION_PIN_COLOR = DANGER;

const WIDTH = 36;
const HEIGHT = 44;
const OUTLINE = 2.5;

/** A teardrop pin with a white outline and centre. Its tip is the bottom middle of the drawing. */
export default function PlacePin({ color, scale = 1 }: { color: string; scale?: number }) {
    return (
        <Svg width={WIDTH * scale} height={HEIGHT * scale} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
            <Path
                d="M18 2C10 2 4 8.2 4 16c0 10 14 26 14 26s14-16 14-26C32 8.2 26 2 18 2z"
                fill={color}
                stroke="#ffffff"
                strokeWidth={OUTLINE}
                strokeLinejoin="round"
            />
            <Circle cx={18} cy={16} r={5.5} fill="#ffffff" />
        </Svg>
    );
}
