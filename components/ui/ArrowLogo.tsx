import React from 'react';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

const VIEWBOX_WIDTH = 389;
const VIEWBOX_HEIGHT = 426;
const GRADIENT_ID = 'arrowLogoGradient';

/** The app's arrow mark. It points up; rotate the parent to aim it. */
export default function ArrowLogo({ width }: { width: number }) {
    return (
        <Svg width={width} height={(width * VIEWBOX_HEIGHT) / VIEWBOX_WIDTH} viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}>
            <Defs>
                <LinearGradient id={GRADIENT_ID} x1="-77.1182" y1="284.977" x2="465.88" y2="285.065" gradientUnits="userSpaceOnUse">
                    <Stop stopColor="#2F80ED" />
                    <Stop offset="1" stopColor="#0056C6" />
                </LinearGradient>
            </Defs>
            <Path
                d="M217.813 39.217C213.683 29.9963 204.519 24 194.45 24C184.381 24 175.16 29.9397 171.087 39.2169L26.2716 365.052C21.8027 374.951 24.0654 386.491 31.8719 393.958C39.6783 401.425 51.388 403.179 61.0047 398.314L194.337 331.62L327.669 398.314C337.342 403.122 348.995 401.425 356.802 393.958C364.608 386.491 366.871 374.951 362.515 365.052L217.7 39.2169L217.813 39.217Z"
                fill={`url(#${GRADIENT_ID})`}
                stroke={`url(#${GRADIENT_ID})`}
                strokeWidth={48}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Rect width={100.489} height={63.1334} rx={31.5667} transform="matrix(-0.406737 0.913545 0.913545 0.406737 126.243 125.985)" fill="white" />
            <Rect x={262.046} y={125.985} width={100.489} height={63.1334} rx={31.5667} transform="rotate(66 262.046 125.985)" fill="white" />
            <Rect width={63.13} height={63.1334} rx={31.565} transform="matrix(-0.406737 0.913545 0.913545 0.406737 126.243 125.985)" fill="black" />
            <Rect x={262.046} y={125.985} width={63.13} height={63.1334} rx={31.565} transform="rotate(66 262.046 125.985)" fill="black" />
        </Svg>
    );
}
