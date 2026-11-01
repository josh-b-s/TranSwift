import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { refineWalkPaths } from '@/store/route.slice';

/** Draws the shown journey's walks along footpaths once the journeys arrive, and again when another journey is picked. */
export function useRefineWalkPaths() {
    const dispatch = useDispatch<AppDispatch>();
    const journeys = useSelector((s: RootState) => s.route.journeys);
    const index = useSelector((s: RootState) => s.route.selectedJourneyIndex);

    useEffect(() => {
        if (journeys.length) dispatch(refineWalkPaths(index));
    }, [dispatch, journeys, index]);
}
