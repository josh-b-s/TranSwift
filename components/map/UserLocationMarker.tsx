import React from 'react';
import { Circle, Marker } from 'react-native-maps';
import { ACCENT } from '@/constants/themes';
import type { CompassHeading } from '@/hooks/compassHeading';
import type { UserPosition } from '@/hooks/userPosition';
import { userMarkerImage } from '@/components/map/userMarkerImages';

// Hex alpha suffixes: about 15% fill, 40% outline.
const ACCURACY_FILL = `${ACCENT}26`;
const ACCURACY_STROKE = `${ACCENT}66`;

/** The user's position as the app arrow turned to the compass heading, with a cone for the heading's uncertainty and a circle for the position's. */
export default function UserLocationMarker({ position, heading }: { position: UserPosition | null; heading: CompassHeading | null }) {
    if (!position) return null;

    return (
        <>
            {position.accuracyM !== null && (
                <Circle
                    center={position}
                    radius={position.accuracyM}
                    fillColor={ACCURACY_FILL}
                    strokeColor={ACCURACY_STROKE}
                    strokeWidth={1}
                />
            )}
            <Marker
                coordinate={position}
                image={userMarkerImage(heading?.accuracyLevel ?? null)}
                rotation={heading?.degrees ?? 0}
                flat
                anchor={{ x: 0.5, y: 0.5 }}
            />
        </>
    );
}
