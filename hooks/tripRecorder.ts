import { useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { endTrip, setTripPace, setTripStep } from '@/store/trip.slice';
import { createTripSession } from '@/services/trips/tripSession';
import { createAlightAlert } from '@/services/trips/alightAlert';
import { paceAgainstBest } from '@/services/trips/livePace';
import { startTracking } from '@/services/trips/locationTracking';
import { applyTrip } from '@/services/trips/personalBests';
import { saveTrip, type SavedTrip } from '@/services/trips/tripStore';
import { saveBests } from '@/services/trips/bestsStore';
import { summarizeTrip, walkTotals } from '@/services/trips/tripSummary';
import { notifyGetOff, notifyTripDone, requestNotificationPermission } from '@/services/trips/tripNotification';

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

    useEffect(() => {
        if (startedAt === null) return;

        const session = createTripSession(steps);
        const checkAlight = createAlightAlert(steps, ride =>
            notifyGetOff(ride.to).catch(err => console.warn('[trip] get-off alert failed:', err)));
        let lastPace: number | null = null;
        let cancelled = false;
        let finished = false;
        let stopTracking: (() => void) | undefined;

        const finish = () => {
            finished = true;
            dispatch(endTrip());
            const { bests: updated, broken } = applyTrip(bests, { startedAt, legs: session.legs });
            const trip: SavedTrip = { startedAt, endedAt: Date.now(), legs: session.legs, records: broken };
            trip.totals = walkTotals(trip);
            Promise.all([saveTrip(trip), saveBests(updated)])
                .then(() => {
                    if (AppState.currentState === 'active') router.push(`/trip/${startedAt}`);
                    else return notifyTripDone(startedAt, summarizeTrip(trip), speedUnitRef.current);
                })
                .catch(err => Alert.alert('Could not save trip', String(err)));
        };

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

        startTracking(locations => {
            if (finished) return;
            const before = session.stepIndex;
            for (const { coords, timestamp } of locations) {
                session.addFix({
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    time: timestamp,
                    accuracy: coords.accuracy,
                });
            }
            if (session.done) {
                finish();
                return;
            }
            if (session.stepIndex !== before) dispatch(setTripStep(session.stepIndex));
            const { coords } = locations[locations.length - 1];
            checkAlight(session.stepIndex, coords);
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
            stopTracking?.();
        };
    }, [startedAt, steps, bests, dispatch]);
}
