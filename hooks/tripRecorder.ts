import { useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { viewTrip } from '@/store/tripView.slice';
import { applySwitch, clearSwitchRequest, endTrip, setLeftEarlyAt, setTripPace, setTripRequiredMps, setTripStep, setTripStopsLeft, type SwitchRequest } from '@/store/trip.slice';
import { createTripSession, rideLegOf } from '@/services/trips/tripSession';
import { forgetResumePoint, rememberResumePoint } from '@/services/trips/resumePoint';
import { haversineMeters } from '@/services/geo/geoUtil';
import { getDb } from '@/services/db/sqliteDb';
import { createAlightAlert } from '@/services/trips/alightAlert';
import { refreshedArrivalMs } from '@/services/trips/liveArrival';
import { paceAgainstBest } from '@/services/trips/livePace';
import { requiredSpeedMps } from '@/services/trips/requiredSpeed';
import { startTracking } from '@/services/trips/locationTracking';
import { applyTrip } from '@/services/trips/personalBests';
import { saveTrip, type SavedLeg, type SavedTrip } from '@/services/trips/tripStore';
import { finishedLegs } from '@/services/trips/tripFormat';
import { rideBetween } from '@/services/trips/switchRoute';
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

    const doneLegs = useSelector((s: RootState) => s.trip.doneLegs);
    // A ref so legs carried over by a switch don't restart the session a second time.
    const doneLegsRef = useRef(doneLegs);
    doneLegsRef.current = doneLegs;
    const resumeReached = useSelector((s: RootState) => s.trip.resumeReached);
    // A ref so the session reads it when it starts without it being a reason to restart.
    const resumeReachedRef = useRef(resumeReached);
    resumeReachedRef.current = resumeReached;
    const switchRequest = useSelector((s: RootState) => s.trip.switchRequest);
    // The running session's way to carry on along a new route, set by the effect below.
    const switchRef = useRef<((request: SwitchRequest) => void) | null>(null);

    useEffect(() => {
        if (!switchRequest) return;
        if (switchRef.current) switchRef.current(switchRequest);
        else dispatch(clearSwitchRequest());
    }, [switchRequest, dispatch]);

    useEffect(() => {
        if (!endRequested) return;
        if (endEarlyRef.current) endEarlyRef.current();
        else dispatch(endTrip());
    }, [endRequested, dispatch]);

    useEffect(() => {
        if (startedAt === null) return;

        const session = createTripSession(steps, resumeReachedRef.current);
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
            // What the step in progress recorded counts towards distance, but a walk cut short sets no per-stop best.
            // Numbered afresh, since each route a trip switched to counts its steps from 0.
            const legs = [...doneLegsRef.current, ...session.legs, ...(partial ? session.inProgress : [])]
                .map((leg, i): SavedLeg => ({ ...leg, stepIndex: i }));
            const { bests: updated, broken } = applyTrip(bests, { startedAt, legs });
            const trip: SavedTrip = { startedAt, endedAt: Date.now(), legs, records: broken };
            if (partial) trip.partial = true;
            trip.totals = walkTotals(trip);
            return Promise.all([saveTrip(trip), saveBests(updated)]).then(() => trip);
        };

        const finish = () => {
            finished = true;
            forgetResumePoint();
            dispatch(endTrip());
            persist(false)
                .then(trip => {
                    if (AppState.currentState === 'active') dispatch(viewTrip({ startedAt }));
                    else return notifyTripDone(startedAt, summarizeTrip(trip), speedUnitRef.current);
                })
                .catch(err => Alert.alert('Could not save trip', String(err)));
        };

        // Saves the trip once the rider has finished a leg, without opening the summary.
        const endEarly = () => {
            if (finished) return;
            finished = true;
            rememberResumePoint(steps, session.stepIndex, session.boarded, session.stopsLeft, Date.now());
            dispatch(endTrip());
            if (finishedLegs([...doneLegsRef.current, ...session.legs]).length === 0) return;
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

        let lastRequiredMps: number | null = null;
        // A walk to a stop must end before the ride from it leaves. Any other step has no deadline to hold the rider to.
        const updateRequiredSpeed = (stepIndex: number, here: { latitude: number; longitude: number }) => {
            const step = steps[stepIndex];
            const nextRide = steps[stepIndex + 1];
            const departureMs = step?.type === 'walk' && nextRide?.type === 'transit' ? nextRide.departureMs : undefined;
            const required = departureMs === undefined ? null : requiredSpeedMps(
                haversineMeters({ lat: here.latitude, lon: here.longitude }, { lat: step.end.latitude, lon: step.end.longitude }),
                departureMs,
                Date.now(),
            );
            const rounded = required === null ? null : Math.round(required * 10) / 10;
            if (rounded === lastRequiredMps) return;
            lastRequiredMps = rounded;
            dispatch(setTripRequiredMps(rounded));
        };

        let lastStopsLeft: number | null = null;
        // Stops left on the current ride, for the sheet and the pinned notification. Clears both once the ride is over.
        const updateRide = (stepIndex: number) => {
            const step = steps[stepIndex];
            if (step?.type !== 'transit' || step.stops.length < 2) {
                if (lastStopsLeft === null) return;
                lastStopsLeft = null;
                dispatch(setTripStopsLeft(null));
                clearRideProgress().catch(err => console.warn('[trip] could not clear the ride notification:', err));
                return;
            }
            // Counting only starts once the rider is on the vehicle, so waiting at the stop doesn't tick stops off.
            const left = session.stopsLeft;
            if (left === lastStopsLeft) return;
            lastStopsLeft = left;
            dispatch(setTripStopsLeft(left));
            if (left === null) clearRideProgress().catch(err => console.warn('[trip] could not clear the ride notification:', err));
            else showRideProgress(step.routeName, step.to, left).catch(err => console.warn('[trip] ride notification failed:', err));
        };

        // Tells the panel when the rider looks to have got off before their stop, so it can offer a new search.
        let lastLeftAt: string | null = null;
        const updateLeftEarly = () => {
            const name = session.leftVehicle?.stopName ?? null;
            if (name === lastLeftAt) return;
            lastLeftAt = name;
            dispatch(setLeftEarlyAt(name));
        };

        // Carries the trip on along a route chosen from the alternatives. On a vehicle it rides on to the stop the new
        // route starts from first, and the part already ridden is kept as a leg of its own.
        const switchTo = ({ steps: next, via }: SwitchRequest) => {
            if (finished) return;
            const carried: SavedLeg[] = [...session.legs];
            let newSteps = next;
            if (via) {
                const step = steps[session.stepIndex];
                const left = lastStopsLeft;
                const onVehicle = step?.type === 'transit' && left !== null ? { step, reached: step.stops.length - 1 - left } : null;
                const viaIndex = onVehicle ? onVehicle.step.stops.findIndex(s => s.latitude === via.latitude && s.longitude === via.longitude) : -1;
                if (!onVehicle || viaIndex <= onVehicle.reached) {
                    Alert.alert('Stop already passed', 'The vehicle has gone past where those options start. Search again for current ones.');
                    dispatch(clearSwitchRequest());
                    return;
                }
                const { step: current, reached } = onVehicle;
                if (reached > 0) carried.push(rideLegOf(rideBetween(current, 0, reached), session.stepIndex));
                newSteps = [rideBetween(current, reached, viaIndex), ...next];
            } else {
                carried.push(...session.inProgress);
            }
            dispatch(applySwitch({ steps: newSteps, legs: carried }));
        };
        switchRef.current = switchTo;

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
            updateRide(session.stepIndex);
            updateLeftEarly();
            checkAlight(session.stepIndex, coords, Date.now(), liveArrival?.stepIndex === session.stepIndex ? liveArrival.ms : undefined);
            updatePace();
            updateRequiredSpeed(session.stepIndex, coords);
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
            switchRef.current = null;
            stopTracking?.();
            clearRideProgress().catch(err => console.warn('[trip] could not clear the ride notification:', err));
        };
    }, [startedAt, steps, bests, dispatch]);
}
