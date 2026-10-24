import { listTrips, saveTrip, type SavedTrip, type WalkTotals } from './tripStore';
import { walkTotals } from './tripSummary';

export type HistoryTrip = SavedTrip & { totals: WalkTotals };

/** Walking figures across all trips; rides are only counted. */
export type HistoryTotals = {
    tripCount: number;
    rideCount: number;
    distanceM: number;
    durationS: number;
    avgSpeedMps: number;
    topSpeedMps: number;
    longestWalkM: number;
};

export const rideCount = (trip: SavedTrip) => trip.legs.filter(leg => leg.kind === 'ride').length;

export const avgSpeedMps = ({ distanceM, durationS }: WalkTotals) => (durationS > 0 ? distanceM / durationS : 0);

/** Newest first. Trips saved before totals existed are decoded once and rewritten with them. */
export async function loadHistory(): Promise<HistoryTrip[]> {
    return Promise.all(
        (await listTrips()).map(async (trip): Promise<HistoryTrip> => {
            if (trip.totals) return { ...trip, totals: trip.totals };
            const upgraded = { ...trip, totals: walkTotals(trip) };
            await saveTrip(upgraded);
            return upgraded;
        }),
    );
}

export function historyTotals(trips: HistoryTrip[]): HistoryTotals {
    const distanceM = trips.reduce((sum, t) => sum + t.totals.distanceM, 0);
    const durationS = trips.reduce((sum, t) => sum + t.totals.durationS, 0);
    return {
        tripCount: trips.length,
        rideCount: trips.reduce((sum, t) => sum + rideCount(t), 0),
        distanceM,
        durationS,
        avgSpeedMps: avgSpeedMps({ distanceM, durationS, topSpeedMps: 0 }),
        topSpeedMps: Math.max(0, ...trips.map(t => t.totals.topSpeedMps)),
        longestWalkM: Math.max(0, ...trips.map(t => t.totals.distanceM)),
    };
}
