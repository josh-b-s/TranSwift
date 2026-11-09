import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '@/store/store';
import { setUserLocation } from '@/store/location.slice';
import { haversineMeters } from '@/services/geo/geoUtil';
import type { UserPosition } from '@/hooks/userPosition';

// Fixes arrive every second; routing only needs the origin to be about right.
const MIN_MOVE_M = 20;

/** Keeps the stored location, which a route's "current location" origin reads, in step with the live fix. */
export function useSyncUserLocation(position: UserPosition | null, enabled: boolean) {
    const dispatch = useDispatch<AppDispatch>();
    const last = useRef<UserPosition | null>(null);

    useEffect(() => {
        if (!enabled || !position) return;
        const prev = last.current;
        const moved = !prev || haversineMeters(
            { lat: prev.latitude, lon: prev.longitude },
            { lat: position.latitude, lon: position.longitude },
        ) >= MIN_MOVE_M;
        if (!moved) return;
        last.current = position;
        dispatch(setUserLocation({ latitude: position.latitude, longitude: position.longitude }));
    }, [position, enabled, dispatch]);
}
