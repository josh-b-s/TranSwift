import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { LatLng } from '@/services/places/places';
import type { GtfsJourney, RouteStop } from '@/services/gtfs/router/routeTypes';
import { computeGtfsRouteNative } from '@/services/gtfs/router/gtfsRouterNative';
import type { AvoidRoute } from '@/services/trips/alternativeSearch';
import { endTrip } from './trip.slice';

export const findAlternatives = createAsyncThunk<
    { journeys: GtfsJourney[] },
    { origin: LatLng; destination: LatLng; departAt: Date; walkingSpeedMps: number; maxWalkDistanceM: number },
    { rejectValue: string }
>('alternatives/find', async ({ origin, destination, departAt, walkingSpeedMps, maxWalkDistanceM }, { rejectWithValue }) => {
    try {
        const result = await computeGtfsRouteNative(origin, destination, departAt, walkingSpeedMps, maxWalkDistanceM);
        return { journeys: result.journeys };
    } catch (err) {
        console.warn('[alternatives] search failed:', err);
        return rejectWithValue(String(err));
    }
});

type State = {
    open: boolean;
    loading: boolean;
    error: string | null;
    journeys: GtfsJourney[];
    /** Where the search starts, as it reads in "Alternatives from …". */
    label: string;
    via: RouteStop | null;
    avoid: AvoidRoute | null;
    avoiding: boolean;
    // Only the latest search may fill the list, so a slow earlier one can't overwrite it.
    requestId: string | null;
};

const initialState: State = {
    open: false, loading: false, error: null, journeys: [], label: '', via: null, avoid: null, avoiding: false, requestId: null,
};

const slice = createSlice({
    name: 'alternatives',
    initialState,
    reducers: {
        openAlternatives(_state, action: PayloadAction<{ label: string; via: RouteStop | null; avoid: AvoidRoute | null; avoiding: boolean }>) {
            return { ...initialState, open: true, ...action.payload };
        },
        closeAlternatives() {
            return initialState;
        },
        setAvoiding(state, action: PayloadAction<boolean>) {
            state.avoiding = action.payload;
        },
    },
    extraReducers: builder => {
        builder
            .addCase(findAlternatives.pending, (s, a) => {
                s.loading = true;
                s.error = null;
                s.requestId = a.meta.requestId;
            })
            .addCase(findAlternatives.fulfilled, (s, a) => {
                if (s.requestId !== a.meta.requestId) return;
                s.loading = false;
                s.journeys = a.payload.journeys;
            })
            .addCase(findAlternatives.rejected, (s, a) => {
                if (s.requestId !== a.meta.requestId) return;
                s.loading = false;
                s.error = a.payload ?? String(a.error);
            })
            .addCase(endTrip, () => initialState);
    },
});

export const { openAlternatives, closeAlternatives, setAvoiding } = slice.actions;
export default slice.reducer;
