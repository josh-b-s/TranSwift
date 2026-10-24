import { useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { endTrip, setTripStep } from '@/store/trip.slice';
import { createTripSession } from '@/services/trips/tripSession';
import { startTracking } from '@/services/trips/locationTracking';
import { applyTrip } from '@/services/trips/personalBests';
import { saveTrip, type SavedTrip } from '@/services/trips/tripStore';
import { saveBests } from '@/services/trips/bestsStore';
import { summarizeTrip } from '@/services/trips/tripSummary';
import { notifyTripDone, requestNotificationPermission } from '@/services/trips/tripNotification';

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
        let cancelled = false;
        let finished = false;
        let stopTracking: (() => void) | undefined;

        const finish = () => {
            finished = true;
            dispatch(endTrip());
            const { bests: updated, broken } = applyTrip(bests, { startedAt, legs: session.legs });
            const trip: SavedTrip = { startedAt, legs: session.legs, records: broken };
            Promise.all([saveTrip(trip), saveBests(updated)])
                .then(() => {
                    if (AppState.currentState === 'active') router.push(`/trip/${startedAt}`);
                    else return notifyTripDone(startedAt, summarizeTrip(trip), speedUnitRef.current);
                })
                .catch(err => Alert.alert('Could not save trip', String(err)));
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
            if (session.done) finish();
            else if (session.stepIndex !== before) dispatch(setTripStep(session.stepIndex));
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
