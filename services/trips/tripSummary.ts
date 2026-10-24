import { decodePath } from './pathCodec';
import { pathStats, type PathStats } from './pathStats';
import type { RideLeg, SavedTrip, WalkLeg } from './tripStore';

export type LegSummary =
    | { kind: 'walk'; leg: WalkLeg; stats: PathStats }
    | { kind: 'ride'; leg: RideLeg };

/** Walking totals for a trip; rides are not part of the speed and distance figures. */
export type TripSummary = {
    distanceM: number;
    durationS: number;
    avgSpeedMps: number;
    topSpeedMps: number;
    rideCount: number;
    legs: LegSummary[];
};

export function summarizeTrip(trip: SavedTrip): TripSummary {
    const legs = trip.legs.map((leg): LegSummary =>
        leg.kind === 'walk' ? { kind: 'walk', leg, stats: pathStats(decodePath(leg.path)) } : { kind: 'ride', leg });
    const walks = legs.flatMap(l => (l.kind === 'walk' ? [l.stats] : []));

    const distanceM = walks.reduce((sum, w) => sum + w.distanceM, 0);
    const durationS = walks.reduce((sum, w) => sum + w.durationS, 0);
    return {
        distanceM,
        durationS,
        avgSpeedMps: durationS > 0 ? distanceM / durationS : 0,
        topSpeedMps: Math.max(0, ...walks.map(w => w.topSpeedMps)),
        rideCount: legs.length - walks.length,
        legs,
    };
}
