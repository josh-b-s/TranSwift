import React from 'react';
import { Circle, Marker } from 'react-native-maps';
import { useIsFocused } from '@react-navigation/native';
import { ACCENT } from '@/constants/themes';
import { useCompassHeading } from '@/hooks/compassHeading';
import { useUserPosition } from '@/hooks/userPosition';
import { userMarkerImage } from '@/components/map/userMarkerImages';

// Hex alpha suffixes: about 15% fill, 40% outline.
const ACCURACY_FILL = `${ACCENT}26`;
const ACCURACY_STROKE = `${ACCENT}66`;

/** The user's position as the app arrow turned to the compass heading, with a cone for the heading's uncertainty and a circle for the position's. */
export default function UserLocationMarker() {
    const active = useIsFocused();
    const position = useUserPosition(active);
    const heading = useCompassHeading(active);

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
