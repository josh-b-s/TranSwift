import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { DebugMeta } from '@/services/gtfs/debug/debugDataStore';


export type DebugPhase = 'bfs' | 'raptor';
const PHASE_ORDER: DebugPhase[] = ['bfs', 'raptor'];

/**
 * How the bfs phase's candidate routes are shown.
 * - 'cumulative': stepIndex is a round number. Shows that round's hull plus every candidate found by then.
 * - 'single': stepIndex is a candidate index (debugBfsPoints.ts's flattenBfsCandidates, in discovery order). Shows one
 *   candidate with the hull of the round it was found in.
 * So stepIndex and the phase length mean different things per mode, see phaseLength.
 * hopColorMode is a separate toggle for how a candidate is colored, not which ones are visible.
 */
export type BfsCandidateMode = 'cumulative' | 'single';

// Target BFS playback rate. 30 fps reads as smooth without flooding react-native-maps with frame pushes; try 60 if choppy.
// 'raptor' uses the slower STEP_INTERVAL_MS in DebugControls.tsx, since its steps are discrete reveals.
export const BFS_TARGET_FPS = 30;
export const BFS_STEP_INTERVAL_MS = Math.round(1000 / BFS_TARGET_FPS);


type State = {
    /**
     * Master toggle. When false, computeRoute doesn't ask computeGtfsRouteNative for debug data (see route.slice.ts),
     * which also avoids the collection cost on normal searches.
     */
    enabled: boolean;
    /**
     * The debug data lives in services/gtfs/debug/debugDataStore.ts, not Redux. Redux holds a version (bumped per search
     * so subscribers re-read) and the step counts phaseLength needs.
     */
    hasData: boolean;
    dataVersion: number;
    bfsRoundCount: number;
    bfsCandidateCount: number;
    raptorStepCount: number;
    /** Which stage of the search is currently being shown. */
    phase: DebugPhase;
    /**
     * Meaning depends on the phase. 'bfs' + cumulative: round index. 'bfs' + single: candidate index (see flattenBfsCandidates).
     * 'raptor': flattened route-check index (not round index), one candidate route per step, replacing the last.
     * Unaffected by hopColorMode.
     */
    stepIndex: number;
    /** Whether DebugControls' auto-advance timer is currently running. */
    playing: boolean;
    /** See BfsCandidateMode. Kept across toggles and searches, since it's a display preference like `enabled`. */
    bfsCandidateMode: BfsCandidateMode;
    /**
     * Bfs phase only. When true, DebugMapOverlay draws every hop of the visible candidates in per-hop colors (the pattern's
     * route_color when it has one) instead of one flat polyline. It changes how candidates are colored, not which are visible,
     * so it doesn't affect phaseLength and persists like bfsCandidateMode.
     */
    hopColorMode: boolean;
};

const initialState: State = {
    enabled: false,
    hasData: false,
    dataVersion: 0,
    bfsRoundCount: 0,
    bfsCandidateCount: 0,
    raptorStepCount: 0,
    phase: 'bfs',
    stepIndex: 0,
    playing: false,
    bfsCandidateMode: 'cumulative',
    hopColorMode: false,
};

/**
 * Number of steps in a phase for the current data and candidate mode. Used by advanceStep and retreatStep.
 * Ignores hopColorMode.
 */
function phaseLength(phase: DebugPhase, s: State, bfsCandidateMode: BfsCandidateMode): number {
    switch (phase) {
        case 'bfs':
            return bfsCandidateMode === 'single'
                ? Math.max(1, s.bfsCandidateCount)
                : Math.max(1, s.bfsRoundCount);
        case 'raptor':
            return Math.max(1, s.raptorStepCount);
    }
}

const slice = createSlice({
    name: 'debug',
    initialState,
    reducers: {
        toggleDebugEnabled(state) {
            state.enabled = !state.enabled;
        },
        setDebugData(state, action: PayloadAction<DebugMeta | null>) {
            const m = action.payload;
            state.hasData = !!m;
            state.dataVersion = m?.version ?? state.dataVersion + 1;
            state.bfsRoundCount = m?.bfsRoundCount ?? 0;
            state.bfsCandidateCount = m?.bfsCandidateCount ?? 0;
            state.raptorStepCount = m?.raptorStepCount ?? 0;
            state.phase = 'bfs';
            state.stepIndex = 0;
            state.playing = false;
        },
        setPlaying(state, action: PayloadAction<boolean>) {
            state.playing = action.payload;
        },
        /**
         * Moves one step forward, or into the next phase when this one is exhausted. Auto-play stops at the last RAPTOR check
         * instead of looping.
         */
        advanceStep(state) {
            if (!state.hasData) return;
            const len = phaseLength(state.phase, state, state.bfsCandidateMode);
            if (state.stepIndex < len - 1) {
                state.stepIndex += 1;
                return;
            }
            const nextPhaseIdx = PHASE_ORDER.indexOf(state.phase) + 1;
            if (nextPhaseIdx < PHASE_ORDER.length) {
                state.phase = PHASE_ORDER[nextPhaseIdx];
                state.stepIndex = 0;
            } else {
                state.playing = false; // reached the very end — stop, don't loop
            }
        },
        /** Mirror of advanceStep, for manual step-back. */
        retreatStep(state) {
            if (!state.hasData) return;
            if (state.stepIndex > 0) { state.stepIndex -= 1; return; }
            const prevPhaseIdx = PHASE_ORDER.indexOf(state.phase) - 1;
            if (prevPhaseIdx >= 0) {
                state.phase = PHASE_ORDER[prevPhaseIdx];
                state.stepIndex = phaseLength(state.phase, state, state.bfsCandidateMode) - 1;
            }
        },
        /** Jumps to a phase, landing on its first step. */
        setPhase(state, action: PayloadAction<DebugPhase>) {
            if (!state.hasData) return;
            state.phase = action.payload;
            state.stepIndex = 0;
            state.playing = false;
        },
        /** Switches how bfs candidates are shown. stepIndex means a round in one mode and a candidate in the other, so it resets to 0. */
        setBfsCandidateMode(state, action: PayloadAction<BfsCandidateMode>) {
            state.bfsCandidateMode = action.payload;
            if (state.phase === 'bfs') {
                state.stepIndex = 0;
                state.playing = false;
            }
        },
        /** Toggles hop-colored rendering. Leaves stepIndex, phase and playing alone, since it doesn't change what stepIndex means. */
        toggleHopColorMode(state) {
            state.hopColorMode = !state.hopColorMode;
        },
        resetToStart(state) {
            state.phase = 'bfs';
            state.stepIndex = 0;
            state.playing = false;
        },
    },
});

export const {
    toggleDebugEnabled, setDebugData, setPlaying, advanceStep, retreatStep, setPhase, setBfsCandidateMode,
    toggleHopColorMode, resetToStart,
} = slice.actions;
export default slice.reducer;
