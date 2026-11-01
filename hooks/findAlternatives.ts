import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { findAlternatives, openAlternatives } from '@/store/alternatives.slice';
import { useCurrentSpeedMps } from '@/hooks/currentSpeed';
import { alternativeStart, routeToAvoid } from '@/services/trips/alternativeSearch';

/** Searches for other ways to the trip's destination, from where the rider is or, on a vehicle, from its next stop. */
export function useFindAlternatives() {
    const dispatch = useDispatch<AppDispatch>();
    const userLocation = useSelector((s: RootState) => s.location.userLocation);
    const { steps, stepIndex, stopsLeft } = useSelector((s: RootState) => s.trip);
    const walkingSpeedMps = useSelector((s: RootState) => s.search.walkingSpeedMps);
    const maxWalkDistanceM = useSelector((s: RootState) => s.preferences.maxWalkDistanceM);
    // Only watched on a vehicle, where it tells when the next stop will be reached.
    const speedMps = useCurrentSpeedMps(stopsLeft !== null);

    return useCallback(() => {
        const destination = steps[steps.length - 1]?.end;
        if (!userLocation || !destination) {
            Alert.alert('Location unavailable', 'Waiting for your current location.');
            return;
        }
        const start = alternativeStart(steps, stepIndex, stopsLeft, userLocation, speedMps, new Date());
        const avoid = routeToAvoid(steps, stepIndex);
        dispatch(openAlternatives({
            label: start.label,
            via: start.via,
            avoid,
            // On a ride, or waiting to board one, the cause is most likely that ride's route.
            avoiding: avoid !== null && steps[stepIndex]?.type === 'transit',
        }));
        dispatch(findAlternatives({
            origin: start.origin,
            destination,
            departAt: start.departAt,
            walkingSpeedMps,
            maxWalkDistanceM,
        }));
    }, [dispatch, userLocation, steps, stepIndex, stopsLeft, speedMps, walkingSpeedMps, maxWalkDistanceM]);
}
