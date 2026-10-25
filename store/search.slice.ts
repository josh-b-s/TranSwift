import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { LatLng, SearchPlace } from '@/services/places/places';
import { searchPlaces as searchPlacesService } from '@/services/places/places';
import { CURRENT_LOCATION } from '@/services/places/endpoints';

export type { SearchPlace };

export type RouteField = 'origin' | 'destination';

export const searchPlaces = createAsyncThunk<
    SearchPlace[],
    { query: string; location?: LatLng; apiKey: string },
    { rejectValue: string }
>('search/searchPlaces', async (payload, { rejectWithValue }) => {
    try {
        return await searchPlacesService(payload.query, {
            apiKey: payload.apiKey,
            location: payload.location,
        });
    } catch (err) {
        return rejectWithValue(String(err));
    }
});

type State = {
    query: string;
    results: SearchPlace[];
    /** The destination. */
    selected: SearchPlace | null;
    /** Where the route starts. CURRENT_LOCATION means the live device position. */
    origin: SearchPlace;
    /** Set while the user is choosing that endpoint by moving the map. */
    pickingField: RouteField | null;
    loading: boolean;
    error?: string | null;
    showResults: boolean;
    /**
     * Epoch ms for the planned departure. null means "leave now": computeRoute passes `undefined` through, so "now" is the moment
     * of search, not whenever this was picked.
     */
    departureTime: number | null;
    /** Meters/sec. Defaults to computeGtfsRouteNative's own default (1.4) so an
     *  untouched picker matches it. */
    walkingSpeedMps: number;
};

const DEFAULT_WALKING_SPEED_MPS = 1.4;

const initialState: State = {
    query: '',
    results: [],
    selected: null,
    origin: CURRENT_LOCATION,
    pickingField: null,
    loading: false,
    error: null,
    showResults: false,
    departureTime: null,
    walkingSpeedMps: DEFAULT_WALKING_SPEED_MPS,
};

const slice = createSlice({
    name: 'search',
    initialState,
    reducers: {
        setQuery(state, action: PayloadAction<string>) {
            state.query = action.payload;
        },
        selectPlace(state, action: PayloadAction<SearchPlace | null>) {
            state.selected = action.payload;
            state.showResults = false;
        },
        setOrigin(state, action: PayloadAction<SearchPlace>) {
            state.origin = action.payload;
            state.showResults = false;
        },
        /** No-op until a destination exists, since there's nothing to swap with. */
        swapEndpoints(state) {
            if (!state.selected) return;
            [state.origin, state.selected] = [state.selected, state.origin];
        },
        startPicking(state, action: PayloadAction<RouteField>) {
            state.pickingField = action.payload;
            state.showResults = false;
        },
        stopPicking(state) {
            state.pickingField = null;
        },
        clearResults(state) {
            state.results = [];
            state.showResults = false;
        },
        setDepartureTime(state, action: PayloadAction<number | null>) {
            state.departureTime = action.payload;
        },
        setWalkingSpeed(state, action: PayloadAction<number>) {
            state.walkingSpeedMps = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(searchPlaces.pending, (s) => { s.loading = true; s.error = null; })
            .addCase(searchPlaces.fulfilled, (s, a) => {
                s.loading = false;
                s.results = a.payload;
                s.showResults = a.payload.length > 0;
            })
            .addCase(searchPlaces.rejected, (s, a) => {
                s.loading = false;
                s.error = a.payload ?? String(a.error);
                s.results = [];
                s.showResults = false;
            });
    },
});

export const {
    setQuery, selectPlace, setOrigin, swapEndpoints, startPicking, stopPicking,
    clearResults, setDepartureTime, setWalkingSpeed,
} = slice.actions;
export default slice.reducer;