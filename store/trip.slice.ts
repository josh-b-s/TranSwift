import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { NO_BESTS, type PersonalBests } from '@/services/trips/personalBests';
import type { RouteStop } from '@/services/gtfs/router/routeTypes';
import type { SavedLeg } from '@/services/trips/tripStore';
import type { TripStep } from '@/services/trips/tripSteps';

/** A new route to follow, waiting for the recorder to carry what was recorded so far over to it. */
export type SwitchRequest = {
    steps: TripStep[];
    /** The stop the new route starts from when the rider is on a vehicle: they ride on to it first. Null when it starts where they stand. */
    via: RouteStop | null;
};

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
    switchRequest: SwitchRequest | null;
    /** Legs recorded on routes the rider has since switched away from. */
    doneLegs: SavedLeg[];
};

const initialState: State = { startedAt: null, steps: [], stepIndex: 0, bests: NO_BESTS, paceS: null, stopsLeft: null, endRequested: false, switchRequest: null, doneLegs: [] };

const slice = createSlice({
    name: 'trip',
    initialState,
    reducers: {
        startTrip(_state, action: PayloadAction<{ startedAt: number; steps: TripStep[]; bests: PersonalBests }>) {
            return { ...action.payload, stepIndex: 0, paceS: null, stopsLeft: null, endRequested: false, switchRequest: null, doneLegs: [] };
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
        requestSwitch(state, action: PayloadAction<SwitchRequest>) {
            state.switchRequest = action.payload;
        },
        clearSwitchRequest(state) {
            state.switchRequest = null;
        },
        /** Carries on the same trip along new steps, keeping the legs recorded so far. */
        applySwitch(state, action: PayloadAction<{ steps: TripStep[]; legs: SavedLeg[] }>) {
            state.steps = action.payload.steps;
            state.doneLegs = [...state.doneLegs, ...action.payload.legs];
            state.stepIndex = 0;
            state.paceS = null;
            state.stopsLeft = null;
            state.switchRequest = null;
        },
        requestEndTrip(state) {
            state.endRequested = true;
        },
        endTrip() {
            return initialState;
        },
    },
});

export const { startTrip, setTripStep, setTripPace, setTripStopsLeft, requestSwitch, clearSwitchRequest, applySwitch, requestEndTrip, endTrip } = slice.actions;
export default slice.reducer;
