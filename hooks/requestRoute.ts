import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { computeRoute } from '@/store/route.slice';
import { placeCoords } from '@/services/places/endpoints';
import type { SearchPlace } from '@/services/places/places';

/** Values that were only just dispatched, so the store hasn't re-rendered with them yet. */
type Overrides = {
    origin?: SearchPlace;
    destination?: SearchPlace;
    departureTime?: number | null;
    walkingSpeedMps?: number;
};

/** Recomputes the route from whatever is in the store. Does nothing until a destination is set. */
export function useRequestRoute() {
    const dispatch = useDispatch<AppDispatch>();
    const userLocation = useSelector((s: RootState) => s.location.userLocation);
    const debugEnabled = useSelector((s: RootState) => s.debug.enabled);
    const storedOrigin = useSelector((s: RootState) => s.search.origin);
    const storedDestination = useSelector((s: RootState) => s.search.selected);
    const storedDeparture = useSelector((s: RootState) => s.search.departureTime);
    const storedSpeed = useSelector((s: RootState) => s.search.walkingSpeedMps);
    const maxWalkDistanceM = useSelector((s: RootState) => s.preferences.maxWalkDistanceM);

    return useCallback((overrides: Overrides = {}) => {
        const destination = overrides.destination ?? storedDestination;
        if (!destination) return;

        const origin = placeCoords(overrides.origin ?? storedOrigin, userLocation);
        const target = placeCoords(destination, userLocation);
        if (!origin || !target) {
            Alert.alert('Location unavailable', 'Waiting for your current location.');
            return;
        }

        const departureTime = overrides.departureTime !== undefined ? overrides.departureTime : storedDeparture;
        dispatch(computeRoute({
            origin,
            destination:     target,
            debugMode:       debugEnabled,
            departureTime:   departureTime ? new Date(departureTime) : undefined,
            walkingSpeedMps: overrides.walkingSpeedMps ?? storedSpeed,
            maxWalkDistanceM,
        }));
    }, [dispatch, userLocation, debugEnabled, storedOrigin, storedDestination, storedDeparture, storedSpeed, maxWalkDistanceM]);
}
