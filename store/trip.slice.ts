import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { NO_BESTS, type PersonalBests } from '@/services/trips/personalBests';
import type { TripStep } from '@/services/trips/tripSteps';

type State = {
    /** Null when no trip is running. */
    startedAt: number | null;
    steps: TripStep[];
    stepIndex: number;
    /** Loaded when the trip starts, so the current walk can show its target. */
    bests: PersonalBests;
    /** Whole seconds ahead (positive) or behind the current walk's best; null when there is no reading. */
    paceS: number | null;
};

const initialState: State = { startedAt: null, steps: [], stepIndex: 0, bests: NO_BESTS, paceS: null };

const slice = createSlice({
    name: 'trip',
    initialState,
    reducers: {
        startTrip(_state, action: PayloadAction<{ startedAt: number; steps: TripStep[]; bests: PersonalBests }>) {
            return { ...action.payload, stepIndex: 0, paceS: null };
        },
        setTripStep(state, action: PayloadAction<number>) {
            state.stepIndex = action.payload;
        },
        setTripPace(state, action: PayloadAction<number | null>) {
            state.paceS = action.payload;
        },
        endTrip() {
            return initialState;
        },
    },
});

export const { startTrip, setTripStep, setTripPace, endTrip } = slice.actions;
export default slice.reducer;
