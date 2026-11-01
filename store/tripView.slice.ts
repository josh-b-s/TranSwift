import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type State = {
    /** The saved trip shown over the map, or null when none is. */
    startedAt: number | null;
    /** Where closing it goes back to, when it was opened from somewhere other than the map. */
    returnTo: 'history' | null;
};

const initialState: State = { startedAt: null, returnTo: null };

const slice = createSlice({
    name: 'tripView',
    initialState,
    reducers: {
        viewTrip(state, action: PayloadAction<{ startedAt: number; returnTo?: 'history' }>) {
            // Opening another trip from the one on screen keeps where closing returns to.
            state.returnTo = action.payload.returnTo ?? (state.startedAt !== null ? state.returnTo : null);
            state.startedAt = action.payload.startedAt;
        },
        closeTripView() {
            return initialState;
        },
    },
});

export const { viewTrip, closeTripView } = slice.actions;
export default slice.reducer;
