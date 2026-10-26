import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { toggleSavedPlace } from '@/store/savedPlaces.slice';
import { isSaved } from '@/services/places/savedPlaces';
import type { SearchPlace } from '@/services/places/places';

/** Whether a place is saved and a toggle for it, for a header's star button. Null place gives no star. */
export function useSavedPlace(place: SearchPlace | null) {
    const dispatch = useDispatch<AppDispatch>();
    const active = useSelector((s: RootState) => place !== null && isSaved(s.savedPlaces.saved, place.place_id));
    const onToggle = useCallback(() => {
        if (place) dispatch(toggleSavedPlace(place));
    }, [dispatch, place]);
    return place ? { active, onToggle } : undefined;
}
