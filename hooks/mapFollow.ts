import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import MapView, { Camera, LatLng } from 'react-native-maps';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { useGoToUserLocation } from '@/hooks/goToUserLocation';
import { angleDeltaDeg, normalizeDeg } from '@/services/geo/angle';
import { createPoseFeed } from '@/services/geo/poseFeed';
import { Spring, stepSpring } from '@/services/geo/spring';
import { fitTilt } from '@/services/geo/tiltFit';

/** Whether the camera stays on the user, and whether it also turns and tilts to face where they face. */
export type FollowMode = 'free' | 'centered' | 'heading';

const HEADING_PITCH = 60;
// In heading mode the camera's middle sits this far down the screen, so the user's dot rides low and the view reaches ahead.
const HEADING_CENTER_FRACTION = 0.7;
// Entering a mode zooms in to at least this, and never zooms out.
const CENTERED_MIN_ZOOM = 15;
const HEADING_MIN_ZOOM = 18;

// The camera chases its targets, closing about 63% of the gap in this long.
const POSITION_TAU_MS = 300;
// Used while the camera is still far from the user, so a long way back to them does not drag.
const FLY_TAU_MS = 150;
const FLY_DISTANCE_M = 50;
const HEADING_TAU_MS = 150;
const ZOOM_TAU_MS = 250;
// Tilt and the dot's drop down the screen each get a spring with this rate, so they start and stop gently. Radians per second.
const TILT_SPRING_RATE = 9;
// Camera updates cost a native call each, so they are sent at about 30 per second. A little under 33 so that
// timestamp jitter at 60 fps does not make some sends wait a third frame.
const MIN_FRAME_MS = 28;
// Close enough to the user for their marker to be moved with the camera instead of left at the raw fix.
const SYNC_DISTANCE_M = 2;
const SETTLED_DEG = 0.3;
// Ground metres per dp at zoom 0 on the equator. Halves with every zoom level and shrinks with cos(latitude).
const M_PER_DP_ZOOM_0 = 156_543.03392;
// While the loop is not driving the zoom, only the user's pinching changes it, so it is re-read this often.
const ZOOM_READ_MS = 500;
// Measuring needs the map nearly fully tilted, and ground points this far (a fraction of the screen height) either side.
const FIT_MIN_TILT = 0.95;
const FIT_GROUND_FRACTION = 0.2;
const FIT_RETRY_MS = 2000;
// A fit outside these is a bad reading, so it is ignored.
const FIT_PERSPECTIVE_RANGE = [300, 5000];
const FIT_SCALE_RANGE = [0.6, 1.6];
// Stops the pitch correction in `behindMetres` from blowing up if the pitch ever gets close to 90.
const MIN_PITCH_COS = 0.5;
const M_PER_DEG_LAT = 111_195;

const rad = (deg: number) => (deg * Math.PI) / 180;

// `tilt` is the pitch as a fraction of full, `drop` is how far the user's dot has moved from the middle of the screen
// to its heading-mode spot as a fraction of full. Both run from 0 to 1.
type Pose = { latitude: number; longitude: number; heading: number; zoom: number; tilt: Spring; drop: Spring };

/**
 * Keeps the camera on `here` until the map is dragged (`release`). Pressing goes free to centered, centered to
 * heading (turned to `headingDeg` and tilted), and heading back to centered. A trip starting switches to heading.
 *
 * Every camera move, entering a mode included, is made by one per-frame loop that eases position, turn, tilt and
 * zoom toward the mode's targets. The user's marker is the map's own. Once the camera has reached the user, each
 * frame the loop publishes the eased position it just aimed the camera at on `poseFeed`, so the marker moves with the
 * camera instead of trailing it at the raw GPS fix. `poseFeed` emits null while the camera is not on the user.
 * While the loop leaves the zoom to the user, it re-reads it from the map now and then, as the offset below needs it.
 *
 * Heading mode needs the camera's middle low on the screen, and the only way to do that is the map's top padding.
 * Padding can't be animated: every change is a React render plus several native calls that race the camera updates.
 * So it is switched on once, while the map is flat, and stays on through centered mode, where the offset keeps the
 * user in the middle of the screen. It comes off only on `release`. Taking it off when the tilt ends would mean the
 * padding and the offset changing in separate native updates, and the user would jump for a frame or two. In between, the camera
 * aims at a point behind the user and that offset eases away, which slides the user from the middle of the screen
 * down to the padded middle. The offset is worked out for a flat map, so it is exact at both ends of the move.
 */
export function useMapFollow(mapRef: RefObject<MapView | null>, here: LatLng | null, headingDeg: number | null) {
    const [mode, setMode] = useState<FollowMode>('free');
    // Whether the map's top padding is on.
    const [padded, setPadded] = useState(false);
    // How far the camera's middle has dropped toward its heading-mode spot, as a fraction of full.
    const dropFraction = useRef(0);
    // How much longer the ground really is on screen than the zoom formula says. Measured once the map is first tilted.
    const scaleFix = useRef(1);
    const fitted = useRef(false);
    const poseFeed = useMemo(createPoseFeed, []);
    const windowHeight = useWindowDimensions().height;
    const goToUserLocation = useGoToUserLocation(mapRef);
    const tripRunning = useSelector((s: RootState) => s.trip.startedAt !== null);

    // Read by the frame loop and by callbacks that must keep one identity.
    const latest = useRef({ mode, here, headingDeg, padded, windowHeight });
    latest.current = { mode, here, headingDeg, padded, windowHeight };
    const wasTripRunning = useRef(tripRunning);

    const release = useCallback(() => {
        setMode('free');
        setPadded(false);
        dropFraction.current = 0;
    }, []);

    const press = useCallback(() => {
        // Nothing to centre on yet, so ask for permission and wait for the first fix.
        if (!latest.current.here) goToUserLocation();
        setMode(latest.current.mode === 'centered' ? 'heading' : 'centered');
    }, [goToUserLocation]);

    useEffect(() => {
        poseFeed.emit(null);
        if (mode === 'free') return;

        let cancelled = false;
        let frameId = 0;
        let pose: Pose | null = null;
        let start: Camera | undefined;
        let zoomTarget = CENTERED_MIN_ZOOM;
        // What the map is really at, which the user's pinching can move away from the loop's own number whenever the
        // loop is not driving it (`zoomDriven`).
        let liveZoom = zoomTarget;
        let zoomDriven = true;
        let lastRead = 0;
        let reading = false;
        let fitting = false;
        let lastFitTry = 0;
        // Latched once the camera first reaches the user, so a flight in from far away does not carry the marker.
        let synced = false;
        let isPadded = latest.current.padded;
        let lastFrame = performance.now();
        let lastSent = 0;

        const frame = (now: number) => {
            frameId = requestAnimationFrame(frame);
            const { here: target, headingDeg: facing, windowHeight: height } = latest.current;
            // Half the padding: how far the padding moves the camera's middle down the screen.
            const dropDp = height * (HEADING_CENTER_FRACTION - 0.5);
            if (!pose) {
                if (!target && !start) return;
                pose = {
                    latitude: start?.center.latitude ?? target!.latitude,
                    longitude: start?.center.longitude ?? target!.longitude,
                    heading: start?.heading ?? 0,
                    zoom: start?.zoom ?? zoomTarget,
                    // A map the user tilted by hand eases down from where it is rather than snapping flat.
                    tilt: { value: Math.min((start?.pitch ?? 0) / HEADING_PITCH, 1), velocity: 0 },
                    drop: { value: isPadded ? dropFraction.current : 0, velocity: 0 },
                };
                liveZoom = pose.zoom;
            }
            const dt = Math.min(now - lastFrame, 100);
            lastFrame = now;
            const ease = (tauMs: number) => 1 - Math.exp(-dt / tauMs);
            const heading = mode === 'heading';

            let distanceM = 0;
            if (target) {
                const dLat = target.latitude - pose.latitude;
                const dLon = target.longitude - pose.longitude;
                distanceM = Math.hypot(dLat * M_PER_DEG_LAT, dLon * M_PER_DEG_LAT * Math.cos(rad(pose.latitude)));
                const k = ease(distanceM > FLY_DISTANCE_M ? FLY_TAU_MS : POSITION_TAU_MS);
                pose.latitude += dLat * k;
                pose.longitude += dLon * k;
            }
            if (!synced && target && distanceM < SYNC_DISTANCE_M) synced = true;
            const wantHeading = heading ? facing ?? pose.heading : 0;
            pose.heading = normalizeDeg(pose.heading + angleDeltaDeg(pose.heading, wantHeading) * ease(HEADING_TAU_MS));
            stepSpring(pose.tilt, heading ? 1 : 0, TILT_SPRING_RATE, dt);
            stepSpring(pose.drop, heading ? 1 : 0, TILT_SPRING_RATE, dt);
            const pitchNow = pose.tilt.value * HEADING_PITCH;
            const zoomGap = zoomTarget - pose.zoom;
            pose.zoom = Math.abs(zoomGap) > 0.01 ? pose.zoom + zoomGap * ease(ZOOM_TAU_MS) : zoomTarget;
            // A flat, north-up map is left alone once it gets there, so the user can tilt and turn it themselves.
            const settledFlat = !heading && pitchNow < SETTLED_DEG && Math.abs(angleDeltaDeg(pose.heading, 0)) < SETTLED_DEG;
            zoomDriven = Math.abs(zoomGap) > 0.01;
            if (zoomDriven) liveZoom = pose.zoom;
            if (!zoomDriven && !reading && now - lastRead > ZOOM_READ_MS) {
                reading = true;
                lastRead = now;
                mapRef.current?.getCamera().then(camera => {
                    liveZoom = camera.zoom ?? liveZoom;
                }).finally(() => { reading = false; });
            }
            const metresPerDp = (M_PER_DP_ZOOM_0 * Math.cos(rad(pose.latitude))) / 2 ** liveZoom / scaleFix.current;

            if (heading && !isPadded) {
                isPadded = true;
                setPadded(true);
            }

            dropFraction.current = isPadded ? pose.drop.value : 0;

            if (now - lastSent < MIN_FRAME_MS) return;
            lastSent = now;
            const center = { latitude: pose.latitude, longitude: pose.longitude };
            if (isPadded) {
                // Padding puts the camera's middle `dropDp` below the screen's. Aim at a point behind the user by
                // however much of that the dot has not yet dropped, so the dot stays where the drop says it is.
                const behindMetres = (dropDp * (1 - pose.drop.value) * metresPerDp) / Math.max(Math.cos(rad(pitchNow)), MIN_PITCH_COS);
                const behind = rad(pose.heading + 180);
                center.latitude += (behindMetres * Math.cos(behind)) / M_PER_DEG_LAT;
                center.longitude += (behindMetres * Math.sin(behind)) / (M_PER_DEG_LAT * Math.cos(rad(pose.latitude)));
            }
            const camera: Partial<Camera> = { center };
            if (!settledFlat) {
                camera.pitch = pitchNow;
                camera.heading = pose.heading;
            }
            if (zoomDriven) camera.zoom = pose.zoom;
            if (synced) poseFeed.emit({ latitude: pose.latitude, longitude: pose.longitude });
            mapRef.current?.setCamera(camera);

            if (!fitted.current && !fitting && isPadded && pose.tilt.value > FIT_MIN_TILT && now - lastFitTry > FIT_RETRY_MS) {
                fitting = true;
                lastFitTry = now;
                fitCamera(center, pitchNow, pose.heading, height * FIT_GROUND_FRACTION, metresPerDp).finally(() => { fitting = false; });
            }
        };

        // Asks the map where it puts two ground points either side of the camera's middle, which shows how it projects.
        const fitCamera = async (center: LatLng, pitchDeg: number, facingDeg: number, groundDp: number, metresPerDp: number) => {
            const map = mapRef.current;
            if (!map) return;
            const metres = groundDp * metresPerDp;
            const facing = rad(facingDeg);
            const along = (sign: number): LatLng => ({
                latitude: center.latitude + (sign * metres * Math.cos(facing)) / M_PER_DEG_LAT,
                longitude: center.longitude + (sign * metres * Math.sin(facing)) / (M_PER_DEG_LAT * Math.cos(rad(center.latitude))),
            });
            const [middle, ahead, behind] = await Promise.all([
                map.pointForCoordinate(center),
                map.pointForCoordinate(along(1)),
                map.pointForCoordinate(along(-1)),
            ]);
            const fit = fitTilt({ farDp: middle.y - ahead.y, nearDp: behind.y - middle.y, groundDp, pitchDeg });
            const [minPerspective, maxPerspective] = FIT_PERSPECTIVE_RANGE;
            const [minScale, maxScale] = FIT_SCALE_RANGE;
            if (!fit || fit.perspective < minPerspective || fit.perspective > maxPerspective) return;
            if (fit.scale < minScale || fit.scale > maxScale) return;
            scaleFix.current *= fit.scale;
            fitted.current = true;
        };

        (async () => {
            start = await mapRef.current?.getCamera();
            if (cancelled) return;
            const minZoom = mode === 'heading' ? HEADING_MIN_ZOOM : CENTERED_MIN_ZOOM;
            zoomTarget = Math.max(start?.zoom ?? minZoom, minZoom);
            lastFrame = performance.now();
            frameId = requestAnimationFrame(frame);
        })();

        return () => {
            cancelled = true;
            cancelAnimationFrame(frameId);
        };
    }, [mode, mapRef, poseFeed]);

    useEffect(() => {
        if (tripRunning && !wasTripRunning.current) setMode('heading');
        // Ending a trip drops the tilt and the turn, but leaves the camera where the user put it.
        if (!tripRunning && wasTripRunning.current && latest.current.mode === 'heading') setMode('centered');
        wasTripRunning.current = tripRunning;
    }, [tripRunning]);

    // Passed to the map's `mapPadding`: top padding moves the camera's middle down the screen.
    const mapPadding = useMemo(
        () => (padded ? { top: windowHeight * (2 * HEADING_CENTER_FRACTION - 1), right: 0, bottom: 0, left: 0 } : undefined),
        [padded, windowHeight],
    );

    return { mode, press, release, mapPadding, poseFeed };
}