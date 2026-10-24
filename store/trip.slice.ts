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
};

const initialState: State = { startedAt: null, steps: [], stepIndex: 0, bests: NO_BESTS };

const slice = createSlice({
    name: 'trip',
    initialState,
    reducers: {
        startTrip(_state, action: PayloadAction<{ startedAt: number; steps: TripStep[]; bests: PersonalBests }>) {
            return { ...action.payload, stepIndex: 0 };
        },
        setTripStep(state, action: PayloadAction<number>) {
            state.stepIndex = action.payload;
        },
        endTrip() {
            return initialState;
        },
    },
});

export const { startTrip, setTripStep, endTrip } = slice.actions;
export default slice.reducer;
