import { useMemo } from 'react';
import { Polyline } from 'react-native-maps';

const RING_WIDTH = 12;
const CENTRE_WIDTH = RING_WIDTH - 6;

type Props = {
    latitude: number;
    longitude: number;
    color: string;
    /** Half the line length in degrees, see dotHalfLengthDeg. A fixed length shows as a stretched line when zoomed in. */
    halfLength: number;
    onPress: () => void;
};

/**
 * A white centre in a ring of the given colour. It is a pair of round-capped zero-length lines, which the map
 * draws centred on the stop at any rotation, unlike view markers whose anchor drifts on Android.
 */
export function StopCircle({ latitude, longitude, color, halfLength, onPress }: Props) {
    const coordinates = useMemo(() => [
        { latitude: latitude - halfLength, longitude },
        { latitude: latitude + halfLength, longitude },
    ], [latitude, longitude, halfLength]);

    return (
        <>
            <Polyline coordinates={coordinates} strokeColor={color} strokeWidth={RING_WIDTH} lineCap="round" tappable onPress={onPress} />
            <Polyline coordinates={coordinates} strokeColor="#ffffff" strokeWidth={CENTRE_WIDTH} lineCap="round" tappable onPress={onPress} />
        </>
    );
}
