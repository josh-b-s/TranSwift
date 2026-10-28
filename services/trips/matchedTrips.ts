import type { HistoryTrip } from './tripHistory';

export type MatchedRun = { trip: HistoryTrip; avgSpeedMps: number };

export type TripMatches = {
    /** Every run of the same journey including the one asked about, newest first. */
    runs: MatchedRun[];
    /** `startedAt` of the run with the best average walking speed, when any run walked. */
    fastestStartedAt: number | null;
};

/** Where a trip began and ended, by stop name. Null for a trip with no steps. */
export const journeyKey = (trip: Pick<HistoryTrip, 'legs'>): string | null =>
    trip.legs.length === 0 ? null : `${trip.legs[0].from}>${trip.legs[trip.legs.length - 1].to}`;

/** The trips that started and ended at the same places as `current`. History is expected newest first. */
export function matchTrips(history: HistoryTrip[], current: HistoryTrip): TripMatches {
    const key = journeyKey(current);
    const runs = key === null
        ? []
        : history.filter(t => journeyKey(t) === key).map(trip => ({ trip, avgSpeedMps: trip.totals.durationS > 0 ? trip.totals.distanceM / trip.totals.durationS : 0 }));

    let fastest: MatchedRun | null = null;
    for (const run of runs) {
        if (run.avgSpeedMps > 0 && (!fastest || run.avgSpeedMps > fastest.avgSpeedMps)) fastest = run;
    }
    return { runs, fastestStartedAt: fastest?.trip.startedAt ?? null };
}
