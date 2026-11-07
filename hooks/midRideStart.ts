import { useEffect, useRef } from 'react';
import { getDb } from '@/services/db/sqliteDb';
import { loadTripPath } from '@/services/gtfs/vehicles/tripPath';
import type { FollowFix } from '@/services/trips/followDetector';
import { resumeFromMatch, rideStepTrips, type MidRideResume, type RideCandidate } from '@/services/trips/midRideResume';
import { addRecentFix } from '@/services/trips/recentFixes';
import type { TripStep } from '@/services/trips/tripSteps';
import { matchRecentPath, type PathFix } from '@/services/trips/vehicleMatch';

/**
 * Calls `onMatch` when the rider's recent fixes show them on one of the ride steps' trips, for a rider who began
 * tracking after boarding. Only the ride steps of `steps` are candidates. `eligible` says whether to look at all.
 */
export function useMidRideStart(
    steps: TripStep[] | null,
    position: FollowFix | null,
    eligible: boolean,
    onMatch: (resume: MidRideResume) => void,
) {
    const recent = useRef<PathFix[]>([]);
    const candidates = useRef<RideCandidate[]>([]);

    useEffect(() => {
        candidates.current = [];
        if (!steps) return;
        let cancelled = false;
        getDb()
            .then(db => Promise.all(rideStepTrips(steps).map(async ({ stepIndex, tripPk }) => {
                const path = await loadTripPath(db, { tripPk });
                return path ? { stepIndex, path } : null;
            })))
            .then(loaded => {
                if (!cancelled) candidates.current = loaded.filter((c): c is RideCandidate => c !== null);
            })
            .catch(err => console.warn('[midRide] could not load the trips to match:', err));
        return () => { cancelled = true; };
    }, [steps]);

    useEffect(() => {
        if (!position) return;
        recent.current = addRecentFix(recent.current, position, Date.now());
        if (!eligible || !steps || candidates.current.length === 0) return;
        const match = matchRecentPath(recent.current, candidates.current.map(c => c.path));
        const resume = match && resumeFromMatch(steps, candidates.current, match);
        if (resume) onMatch(resume);
    }, [position]);
}
