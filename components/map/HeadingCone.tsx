import React from 'react';
import Svg, { Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { ACCENT } from '@/constants/themes';

const GRADIENT_ID = 'headingConeGradient';

/** A wedge fanning up from the centre of a square `size`, fading out toward the edge. */
export default function HeadingCone({ size, halfAngleDeg }: { size: number; halfAngleDeg: number }) {
    const center = size / 2;
    const halfAngle = (halfAngleDeg * Math.PI) / 180;
    const dx = center * Math.sin(halfAngle);
    const dy = center * Math.cos(halfAngle);
    const wedge = `M ${center} ${center} L ${center - dx} ${center - dy} A ${center} ${center} 0 0 1 ${center + dx} ${center - dy} Z`;

    return (
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
            <Defs>
                <RadialGradient id={GRADIENT_ID} cx={center} cy={center} r={center} gradientUnits="userSpaceOnUse">
                    <Stop offset="0" stopColor={ACCENT} stopOpacity={0.5} />
                    <Stop offset="1" stopColor={ACCENT} stopOpacity={0} />
                </RadialGradient>
            </Defs>
            <Path d={wedge} fill={`url(#${GRADIENT_ID})`} />
        </Svg>
    );
}
