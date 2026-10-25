// debugDataStore.ts
// Holds the large GtfsDebugInfo outside Redux. A debug search produces thousands of coordinates. In state.debug.data every
// dispatch paid for it: RTK's checks deep-walked it for 24s, Immer froze it, and advanceStep re-ran flattenBfsCandidates
// on a draft 30 times a second. Redux holds only a small `meta` (counts and a version); components read the data through
// useDebugData().

import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';
import type { GtfsDebugInfo } from '@/services/gtfs/router/routeTypes';
import { flattenBfsCandidates, raptorStepCount } from './debugBfsPoints';
import type { BfsCandidateStep } from './debugBfsPoints';

export type DebugMeta = {
    version: number;
    bfsRoundCount: number;
    bfsCandidateCount: number;
    raptorStepCount: number;
};

let current: GtfsDebugInfo | null = null;
let candidateSteps: BfsCandidateStep[] = [];
let version = 0;

/** Stores the data and computes everything derived from it ONCE. Returns
 *  the small serializable meta to put in Redux (null clears). */
export function publishDebugData(info: GtfsDebugInfo | null | undefined): DebugMeta | null {
    version += 1;
    if (!info) {
        current = null;
        candidateSteps = [];
        return null;
    }
    current = info;
    candidateSteps = flattenBfsCandidates(info.seedPaths, info.bfsLevels, info.seedPathDepths);
    return {
        version,
        bfsRoundCount: info.bfsLevels?.length ?? 0,
        bfsCandidateCount: candidateSteps.length,
        raptorStepCount: raptorStepCount(info),
    };
}

/**
 * Subscribes to the version in Redux and returns the module-level data. Identity-stable until the next publishDebugData,
 * so it is safe as a useMemo dependency.
 */
export function useDebugData(): GtfsDebugInfo | null {
    useSelector((s: RootState) => s.debug.dataVersion);
    return current;
}

export function useBfsCandidateSteps(): BfsCandidateStep[] {
    useSelector((s: RootState) => s.debug.dataVersion);
    return candidateSteps;
}
