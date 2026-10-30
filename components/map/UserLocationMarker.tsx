import React, { useEffect, useState } from 'react';
import { Circle, LatLng, Marker } from 'react-native-maps';
import type { CompassHeading } from '@/hooks/compassHeading';
import type { UserPosition } from '@/hooks/userPosition';
import type { PoseFeed } from '@/services/geo/poseFeed';
import { ACCURACY_FILL, ACCURACY_STROKE } from '@/components/map/accuracyColors';
import { userMarkerImage } from '@/components/map/userMarkerImages';

// Measured on a recording: with the map tilted the arrow draws right of the circle's centre by about this much of its
// width, whatever its rotation. The anchor is moved the same way to cancel it.
const TILTED_ANCHOR_X = 0.513;

/**
 * The user's position as the app arrow turned to the compass heading, with a circle for the position's accuracy.
 * While the camera follows the user it is drawn where the camera is aimed (`poseFeed`) rather than at the raw fix,
 * so the two move together.
 */
export default function UserLocationMarker({ position, heading, poseFeed, tilted }: {
    position: UserPosition | null;
    heading: CompassHeading | null;
    poseFeed: PoseFeed;
    tilted: boolean;
}) {
    const [followed, setFollowed] = useState<LatLng | null>(null);
    useEffect(() => poseFeed.subscribe(setFollowed), [poseFeed]);

    if (!position) return null;
    const center = followed ?? position;

    return (
        <>
            {position.accuracyM !== null && (
                <Circle
                    center={center}
                    radius={position.accuracyM}
                    fillColor={ACCURACY_FILL}
                    strokeColor={ACCURACY_STROKE}
                    strokeWidth={1}
                />
            )}
            <Marker
                coordinate={center}
                image={userMarkerImage(heading?.accuracyLevel ?? null)}
                rotation={heading?.degrees ?? 0}
                flat
                anchor={{ x: tilted ? TILTED_ANCHOR_X : 0.5, y: 0.5 }}
            />
        </>
    );
}
