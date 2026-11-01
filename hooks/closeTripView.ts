import { useCallback } from 'react';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { closeTripView } from '@/store/tripView.slice';

/** Takes the trip off the map, and back to History when that is where it was opened from. */
export function useCloseTripView() {
    const dispatch = useDispatch<AppDispatch>();
    const returnTo = useSelector((s: RootState) => s.tripView.returnTo);

    return useCallback(() => {
        dispatch(closeTripView());
        if (returnTo === 'history') router.navigate('/history');
    }, [dispatch, returnTo]);
}
