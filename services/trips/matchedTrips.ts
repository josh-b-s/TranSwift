import { finishedLegs } from './tripFormat';
import type { HistoryTrip } from './tripHistory';

export type MatchedRun = {
    trip: HistoryTrip;
    avgSpeedMps: number;
    /** Seconds from start to finish, riding included. Null for a trip saved without an end time. */
    totalS: number | null;
};

export type TripMatches = {
    /** Every run of the same journey including the one asked about, newest first. */
    runs: MatchedRun[];
    /** `startedAt` of the run with the best average walking speed, when any run walked. */
    fastestStartedAt: number | null;
    /** `startedAt` of the run with the shortest total time, when at least two runs have one. */
    quickestStartedAt: number | null;
};

/** Where a trip began and ended, by stop name. Null for a trip with no steps. */
export const journeyKey = (trip: Pick<HistoryTrip, 'legs'>): string | null => {
    const done = finishedLegs(trip.legs);
    return done.length === 0 ? null : `${done[0].from}>${done[done.length - 1].to}`;
};

/** The trips that started and ended at the same places as `current`. History is expected newest first. */
export function matchTrips(history: HistoryTrip[], current: HistoryTrip): TripMatches {
    const key = journeyKey(current);
    const runs = key === null
        ? []
        : history.filter(t => journeyKey(t) === key).map((trip): MatchedRun => ({
            trip,
            avgSpeedMps: trip.totals.durationS > 0 ? trip.totals.distanceM / trip.totals.durationS : 0,
            totalS: trip.endedAt !== undefined && trip.endedAt > trip.startedAt ? Math.round((trip.endedAt - trip.startedAt) / 1000) : null,
        }));

    let fastest: MatchedRun | null = null;
    for (const run of runs) {
        if (run.avgSpeedMps > 0 && (!fastest || run.avgSpeedMps > fastest.avgSpeedMps)) fastest = run;
    }

    const timed = runs.filter(run => run.totalS !== null);
    const quickest = timed.length >= 2 ? timed.reduce((best, run) => (run.totalS! < best.totalS! ? run : best)) : null;
    return { runs, fastestStartedAt: fastest?.trip.startedAt ?? null, quickestStartedAt: quickest?.trip.startedAt ?? null };
}
