import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store/store';
import { startTrip } from '@/store/trip.slice';
import { stepsFromJourney } from '@/services/trips/tripSteps';
import { loadBests } from '@/services/trips/bestsStore';
import type { MidRideResume } from '@/services/trips/midRideResume';
import type { GtfsJourney } from '@/services/gtfs/router/routeTypes';

/** Returns a function that starts a trip along the given journey, or along `resume` when the rider joined it mid-ride. */
export function useStartTrip() {
    const dispatch = useDispatch<AppDispatch>();

    return useCallback((journey: GtfsJourney, resume?: MidRideResume) => {
        const steps = resume?.steps ?? stepsFromJourney(journey);
        loadBests()
            .then(bests => dispatch(startTrip({ startedAt: Date.now(), steps, bests, resumeReached: resume?.reachedStop })))
            .catch(err => Alert.alert('Could not start trip', String(err)));
    }, [dispatch]);
}
