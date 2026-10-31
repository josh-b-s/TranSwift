import { useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { endTrip, setTripPace, setTripStep, setTripStopsLeft } from '@/store/trip.slice';
import { createTripSession } from '@/services/trips/tripSession';
import { getDb } from '@/services/db/sqliteDb';
import { createAlightAlert } from '@/services/trips/alightAlert';
import { refreshedArrivalMs } from '@/services/trips/liveArrival';
import { paceAgainstBest } from '@/services/trips/livePace';
import { createRideProgress } from '@/services/trips/rideProgress';
import { startTracking } from '@/services/trips/locationTracking';
import { applyTrip } from '@/services/trips/personalBests';
import { saveTrip, type SavedTrip } from '@/services/trips/tripStore';
import { saveBests } from '@/services/trips/bestsStore';
import { summarizeTrip, walkTotals } from '@/services/trips/tripSummary';
import { clearRideProgress, notifyGetOff, notifyTripDone, requestNotificationPermission, showRideProgress } from '@/services/trips/tripNotification';

const ARRIVAL_REFRESH_MS = 30_000;

/** While a trip is running, tracks the rider through its steps and saves the trip on arrival. */
export function useTripRecorder() {
    const dispatch = useDispatch<AppDispatch>();
    const startedAt = useSelector((s: RootState) => s.trip.startedAt);
    const steps = useSelector((s: RootState) => s.trip.steps);
    const bests = useSelector((s: RootState) => s.trip.bests);
    const speedUnit = useSelector((s: RootState) => s.preferences.speedUnit);
    // A ref so changing the unit mid-trip doesn't restart the session.
    const speedUnitRef = useRef(speedUnit);
    speedUnitRef.current = speedUnit;
    const endRequested = useSelector((s: RootState) => s.trip.endRequested);
    // The running session's way to end early, set by the effect below.
    const endEarlyRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (!endRequested) return;
        if (endEarlyRef.current) endEarlyRef.current();
        else dispatch(endTrip());
    }, [endRequested, dispatch]);

    useEffect(() => {
        if (startedAt === null) return;

        const session = createTripSession(steps);
        const checkAlight = createAlightAlert(steps, ride =>
            notifyGetOff(ride.to).catch(err => console.warn('[trip] get-off alert failed:', err)));
        let lastPace: number | null = null;
        // A one-stop ride's arrival time is refreshed from realtime data while it is the current step, so a late
        // vehicle does not set the alert off early.
        let liveArrival: { stepIndex: number; ms: number } | null = null;
        let lastArrivalRefresh = 0;
        const refreshArrival = (stepIndex: number) => {
            const step = steps[stepIndex];
            if (step?.type !== 'transit' || step.stops.length !== 2) return;
            if (Date.now() - lastArrivalRefresh < ARRIVAL_REFRESH_MS) return;
            lastArrivalRefresh = Date.now();
            getDb()
                .then(db => refreshedArrivalMs(db, step, new Date()))
                .then(ms => { if (ms !== null && !finished) liveArrival = { stepIndex, ms }; })
                .catch(err => console.warn('[trip] could not refresh the arrival time:', err));
        };
        let cancelled = false;
        let finished = false;
        let stopTracking: (() => void) | undefined;

        const persist = (partial: boolean): Promise<SavedTrip> => {
            // A walk cut short adds to the distance totals, but sets no per-stop best.
            const unfinished = partial ? session.unfinishedWalk : null;
            const legs = unfinished ? [...session.legs, unfinished] : session.legs;
            const { bests: updated, broken } = applyTrip(bests, { startedAt, legs });
            const trip: SavedTrip = { startedAt, endedAt: Date.now(), legs, records: broken };
            if (partial) trip.partial = true;
            trip.totals = walkTotals(trip);
            return Promise.all([saveTrip(trip), saveBests(updated)]).then(() => trip);
        };

        const finish = () => {
            finished = true;
            dispatch(endTrip());
            persist(false)
                .then(trip => {
                    if (AppState.currentState === 'active') router.push(`/trip/${startedAt}`);
                    else return notifyTripDone(startedAt, summarizeTrip(trip), speedUnitRef.current);
                })
                .catch(err => Alert.alert('Could not save trip', String(err)));
        };

        // Saves the trip once the rider has finished a leg, without opening the summary.
        const endEarly = () => {
            if (finished) return;
            finished = true;
            dispatch(endTrip());
            if (session.legs.length === 0) return;
            persist(true).catch(err => Alert.alert('Could not save trip', String(err)));
        };
        endEarlyRef.current = endEarly;

        // Only dispatches when the whole-second reading changes. Also clears it when a step ends.
        const updatePace = () => {
            const step = steps[session.stepIndex];
            const best = step.type === 'walk' && step.bestKey ? bests.legs[step.bestKey] : undefined;
            const progress = session.walkProgress;
            const ahead = best && progress ? paceAgainstBest(progress, best.avgSpeedMps) : null;
            const rounded = ahead === null ? null : Math.round(ahead);
            if (rounded === lastPace) return;
            lastPace = rounded;
            dispatch(setTripPace(rounded));
        };

        let ride: { stepIndex: number; progress: ReturnType<typeof createRideProgress> } | null = null;
        let lastStopsLeft: number | null = null;
        // Stops left on the current ride, for the sheet and the pinned notification. Clears both once the ride is over.
        const updateRide = (stepIndex: number, fix: { latitude: number; longitude: number }, boarded: boolean) => {
            const step = steps[stepIndex];
            if (step?.type !== 'transit' || step.stops.length < 2) {
                if (lastStopsLeft === null) return;
                lastStopsLeft = null;
                dispatch(setTripStopsLeft(null));
                clearRideProgress().catch(err => console.warn('[trip] could not clear the ride notification:', err));
                return;
            }
            if (ride?.stepIndex !== stepIndex) ride = { stepIndex, progress: createRideProgress(step.stops) };
            // Counting only starts once the rider is on the vehicle, so waiting at the stop doesn't tick stops off.
            const left = boarded ? ride.progress.update(fix) : null;
            if (left === lastStopsLeft) return;
            lastStopsLeft = left;
            dispatch(setTripStopsLeft(left));
            if (left === null) clearRideProgress().catch(err => console.warn('[trip] could not clear the ride notification:', err));
            else showRideProgress(step.routeName, step.to, left).catch(err => console.warn('[trip] ride notification failed:', err));
        };

        startTracking(locations => {
            if (finished) return;
            const before = session.stepIndex;
            for (const { coords, timestamp } of locations) {
                session.addFix({
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    time: timestamp,
                    accuracy: coords.accuracy,
                    speed: coords.speed,
                });
            }
            if (session.done) {
                finish();
                return;
            }
            if (session.stepIndex !== before) dispatch(setTripStep(session.stepIndex));
            const { coords } = locations[locations.length - 1];
            refreshArrival(session.stepIndex);
            updateRide(session.stepIndex, coords, session.boarded);
            checkAlight(session.stepIndex, coords, Date.now(), liveArrival?.stepIndex === session.stepIndex ? liveArrival.ms : undefined);
            updatePace();
        })
            .then(stop => {
                if (cancelled) {
                    stop();
                    return;
                }
                stopTracking = stop;
                requestNotificationPermission().catch(err => console.warn('[trip] notification permission failed:', err));
            })
            .catch(err => {
                Alert.alert('Could not start tracking', err instanceof Error ? err.message : String(err));
                dispatch(endTrip());
            });

        return () => {
            cancelled = true;
            endEarlyRef.current = null;
            stopTracking?.();
            clearRideProgress().catch(err => console.warn('[trip] could not clear the ride notification:', err));
        };
    }, [startedAt, steps, bests, dispatch]);
}
