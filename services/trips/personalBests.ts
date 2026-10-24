import { decodePath } from './pathCodec';
import { MAX_PLAUSIBLE_MPS, pathStats } from './pathStats';
import type { SavedTrip } from './tripStore';

export type LegBest = { avgSpeedMps: number; startedAt: number };

export type PersonalBests = {
    /** Fastest average speed per walk between two stops, keyed by `bestKey`. */
    legs: Record<string, LegBest>;
    /** Most walked in a single trip. */
    longestWalkM: number;
};

export const NO_BESTS: PersonalBests = { legs: {}, longestWalkM: 0 };

export type BrokenRecord =
    | { kind: 'speed'; from: string; to: string; speedMps: number; previousMps: number | null }
    | { kind: 'distance'; distanceM: number; previousM: number };

// Shorter legs are mostly the arrival-radius trim.
const MIN_LEG_M = 100;

export function applyTrip(bests: PersonalBests, trip: Pick<SavedTrip, 'startedAt' | 'legs'>): { bests: PersonalBests; broken: BrokenRecord[] } {
    const next: PersonalBests = { legs: { ...bests.legs }, longestWalkM: bests.longestWalkM };
    const broken: BrokenRecord[] = [];
    let walkedM = 0;

    for (const leg of trip.legs) {
        if (leg.kind !== 'walk') continue;
        const { distanceM, avgSpeedMps } = pathStats(decodePath(leg.path));
        walkedM += distanceM;

        if (!leg.bestKey || distanceM < MIN_LEG_M || avgSpeedMps > MAX_PLAUSIBLE_MPS) continue;
        const previous = next.legs[leg.bestKey];
        if (!previous || avgSpeedMps > previous.avgSpeedMps) {
            next.legs[leg.bestKey] = { avgSpeedMps, startedAt: trip.startedAt };
            broken.push({ kind: 'speed', from: leg.from, to: leg.to, speedMps: avgSpeedMps, previousMps: previous?.avgSpeedMps ?? null });
        }
    }

    if (walkedM > next.longestWalkM) {
        broken.push({ kind: 'distance', distanceM: walkedM, previousM: next.longestWalkM });
        next.longestWalkM = walkedM;
    }
    return { bests: next, broken };
}
