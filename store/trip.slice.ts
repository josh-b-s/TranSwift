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
    /** Stops left on the current ride, counting the one to get off at; null when not riding or not known yet. */
    stopsLeft: number | null;
    /** Set when the rider ends the trip, so the recorder can save what was followed before the trip is cleared. */
    endRequested: boolean;
};

const initialState: State = { startedAt: null, steps: [], stepIndex: 0, bests: NO_BESTS, paceS: null, stopsLeft: null, endRequested: false };

const slice = createSlice({
    name: 'trip',
    initialState,
    reducers: {
        startTrip(_state, action: PayloadAction<{ startedAt: number; steps: TripStep[]; bests: PersonalBests }>) {
            return { ...action.payload, stepIndex: 0, paceS: null, stopsLeft: null, endRequested: false };
        },
        setTripStep(state, action: PayloadAction<number>) {
            state.stepIndex = action.payload;
        },
        setTripPace(state, action: PayloadAction<number | null>) {
            state.paceS = action.payload;
        },
        setTripStopsLeft(state, action: PayloadAction<number | null>) {
            state.stopsLeft = action.payload;
        },
        requestEndTrip(state) {
            state.endRequested = true;
        },
        endTrip() {
            return initialState;
        },
    },
});

export const { startTrip, setTripStep, setTripPace, setTripStopsLeft, requestEndTrip, endTrip } = slice.actions;
export default slice.reducer;
