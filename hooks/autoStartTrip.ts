import { useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { selectDisplayedJourney } from '@/store/route.slice';
import { useStartTrip } from '@/hooks/startTrip';
import { createFollowDetector, type FollowFix } from '@/services/trips/followDetector';
import { withinStartWindow } from '@/services/trips/startWindow';
import type { GtfsJourney } from '@/services/gtfs/router/routeTypes';

// Stays the same when the journey is recomputed, so ending a trip doesn't start the same one again.
const journeyId = (j: GtfsJourney) =>
    `${j.departureTime}|${j.arrivalTime}|${j.legs.map(leg => leg.routeName).join(',')}`;

/** Starts a trip on the shown journey once the rider, seen at its start, walks away from it. Needs fixes, so only works while they come in. */
export function useAutoStartTrip(position: FollowFix | null) {
    const journey = useSelector(selectDisplayedJourney);
    const running = useSelector((s: RootState) => s.trip.startedAt !== null);
    const startTrip = useStartTrip();
    const detector = useMemo(() => {
        const firstStep = journey?.segments[0];
        if (!journey || !firstStep?.coords.length) return null;
        return createFollowDetector(journey.coords[0], firstStep.coords[firstStep.coords.length - 1]);
    }, [journey]);
    // The journey a trip was last started on, by this hook or by the button.
    const usedId = useRef<string | undefined>(undefined);

    useEffect(() => {
        if (running && journey) usedId.current = journeyId(journey);
    }, [running, journey]);

    useEffect(() => {
        if (!journey || !detector || !position || running || usedId.current === journeyId(journey)) return;
        if (!withinStartWindow(journey.departureTime, journey.legs[0]?.departureTime, new Date())) return;
        if (detector.update(position)) {
            usedId.current = journeyId(journey);
            startTrip(journey);
        }
    }, [journey, detector, position, running, startTrip]);
}
