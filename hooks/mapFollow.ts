import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import MapView, { Camera, LatLng } from 'react-native-maps';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { useGoToUserLocation } from '@/hooks/goToUserLocation';

/** Whether the camera stays on the user, and whether it also turns and tilts to face where they face. */
export type FollowMode = 'free' | 'centered' | 'heading';

const HEADING_PITCH = 60;
// In heading mode the camera's middle sits this far down the screen, so the user's dot rides low and the view reaches ahead.
const HEADING_CENTER_FRACTION = 0.7;
// Entering a mode zooms in to at least this, and never zooms out.
const CENTERED_MIN_ZOOM = 15;
const HEADING_MIN_ZOOM = 18;
const FOLLOW_MS = 250;
const ENTER_MS = 500;

type Entry = { zoom?: number; flatten?: boolean };

/**
 * Keeps the camera on `here` until the map is dragged (`release`). Pressing goes free to centered, centered to
 * heading (turned to `headingDeg` and tilted), and heading back to centered. A trip starting switches to heading.
 */
export function useMapFollow(mapRef: RefObject<MapView | null>, here: LatLng | null, headingDeg: number | null) {
    const [mode, setMode] = useState<FollowMode>('free');
    const windowHeight = useWindowDimensions().height;
    const modeRef = useRef(mode);
    modeRef.current = mode;
    // What the first camera move after a mode change has to do on top of following.
    const entry = useRef<Entry>({});
    const goToUserLocation = useGoToUserLocation(mapRef);
    const tripRunning = useSelector((s: RootState) => s.trip.startedAt !== null);
    const wasTripRunning = useRef(tripRunning);

    const enter = useCallback(async (next: Exclude<FollowMode, 'free'>) => {
        const camera = await mapRef.current?.getCamera();
        const minZoom = next === 'heading' ? HEADING_MIN_ZOOM : CENTERED_MIN_ZOOM;
        entry.current = {
            zoom: camera?.zoom !== undefined && camera.zoom < minZoom ? minZoom : undefined,
            flatten: next === 'centered',
        };
        setMode(next);
    }, [mapRef]);

    const release = useCallback(() => setMode('free'), []);

    const press = useCallback(() => {
        // Nothing to centre on yet, so ask for permission and wait for the first fix.
        if (!here) goToUserLocation();
        enter(modeRef.current === 'centered' ? 'heading' : 'centered');
    }, [here, goToUserLocation, enter]);

    useEffect(() => {
        if (mode === 'free' || !here) return;
        const { zoom, flatten } = entry.current;
        entry.current = {};

        const camera: Partial<Camera> = { center: { latitude: here.latitude, longitude: here.longitude } };
        if (zoom !== undefined) camera.zoom = zoom;
        if (mode === 'heading') {
            camera.pitch = HEADING_PITCH;
            if (headingDeg !== null) camera.heading = headingDeg;
        } else if (flatten) {
            camera.pitch = 0;
            camera.heading = 0;
        }
        mapRef.current?.animateCamera(camera, { duration: zoom === undefined && !flatten ? FOLLOW_MS : ENTER_MS });
    }, [mode, here, headingDeg, mapRef]);

    useEffect(() => {
        if (tripRunning && !wasTripRunning.current) enter('heading');
        // Ending a trip drops the tilt and the turn, but leaves the camera where the user put it.
        if (!tripRunning && wasTripRunning.current && modeRef.current === 'heading') enter('centered');
        wasTripRunning.current = tripRunning;
    }, [tripRunning, enter]);

    // Passed to the map's `mapPadding`: top padding moves the camera's middle down the screen.
    const padding = useMemo(
        () => (mode === 'heading' ? { top: windowHeight * (2 * HEADING_CENTER_FRACTION - 1), right: 0, bottom: 0, left: 0 } : undefined),
        [mode, windowHeight],
    );

    return { mode, press, release, padding };
}
