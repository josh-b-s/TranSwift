import { useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { selectDisplayedJourney } from '@/store/route.slice';
import { useStartTrip } from '@/hooks/startTrip';
import { createFollowDetector, type FollowFix } from '@/services/trips/followDetector';
import type { GtfsJourney } from '@/services/gtfs/router/routeTypes';

/** Starts a trip on the shown journey once the rider is seen moving along it. Needs fixes, so only works while they come in. */
export function useAutoStartTrip(position: FollowFix | null) {
    const journey = useSelector(selectDisplayedJourney);
    const running = useSelector((s: RootState) => s.trip.startedAt !== null);
    const startTrip = useStartTrip();
    const detector = useMemo(
        () => (journey?.segments.length ? createFollowDetector(journey.coords) : null),
        [journey],
    );
    // The journey a trip was last started on, by this hook or by the button, so ending that trip doesn't start it again.
    const usedJourney = useRef<GtfsJourney | undefined>(undefined);

    useEffect(() => {
        if (running) usedJourney.current = journey;
    }, [running, journey]);

    useEffect(() => {
        if (!journey || !detector || !position || running || usedJourney.current === journey) return;
        if (detector.update(position)) {
            usedJourney.current = journey;
            startTrip(journey);
        }
    }, [journey, detector, position, running, startTrip]);
}
