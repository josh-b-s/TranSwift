import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { LatLng } from '@/services/places/places';
import type { GtfsRouteResult, GtfsJourney, RouteSegment } from '@/services/gtfs/router/routeTypes';
import { computeGtfsRouteNative } from '@/services/gtfs/router/gtfsRouterNative';
import { setDebugData } from './debug.slice';
import { publishDebugData } from '@/services/gtfs/debug/debugDataStore';
import { fetchWalkPath, hasWalkRouting } from '@/services/routing/walkPath';
import { withWalkPaths } from '@/services/routing/withWalkPaths';
import { segmentMeters } from '@/services/gtfs/router/walkTimes';
import { arriveBySearch } from '@/services/gtfs/router/arriveBy';
import { retimeJourney } from '@/services/gtfs/router/journeyTimes';

export const computeRoute = createAsyncThunk<
    GtfsRouteResult,
    {
        origin: LatLng;
        destination: LatLng;
        debugMode?: boolean;
        /**
         * Undefined -> computeGtfsRouteNative's own default (`new Date()` at call time, i.e. "leave now"). Passed through as-is so
         * "now" is the actual moment of search.
         */
        departureTime?: Date;
        /** Treats `departureTime` as the time to arrive by. Needs `departureTime`. */
        arriveBy?: boolean;
        /** Undefined -> computeGtfsRouteNative's own default (1.4 m/s). */
        walkingSpeedMps?: number;
        /** Undefined -> computeGtfsRouteNative's own default. */
        maxWalkDistanceM?: number;
    },
    { rejectValue: string }
>('route/compute', async ({ origin, destination, debugMode = false, departureTime, arriveBy = false, walkingSpeedMps, maxWalkDistanceM }, { rejectWithValue, dispatch }) => {
    try {
        const search = (at?: Date) => computeGtfsRouteNative(origin, destination, at, walkingSpeedMps, maxWalkDistanceM, debugMode);
        const result = arriveBy && departureTime
            ? { journeys: await arriveBySearch(async at => (await search(at)).journeys, departureTime.getTime(), Date.now()), debug: undefined }
            : await search(departureTime);
        // Dispatched inside the thunk because debug data belongs in debug.slice, not route state. The big payload goes to the
        // module-level store and only its small meta enters Redux. Don't return `result` as-is: a thunk's return value becomes the
        // `fulfilled` payload, which RTK's dev middleware deep-walks, so strip `debug` from it.
        dispatch(setDebugData(publishDebugData(debugMode ? result.debug : null)));
        return { journeys: result.journeys };
    } catch (err) {
        console.error('[route.slice] computeRoute failed:', err);
        if (err instanceof Error) console.error(err.stack);
        return rejectWithValue(String(err));
    }
});

/** Routes the walks of one journey along footpaths. Skipped when no key is set or the journey was already done. */
export const refineWalkPaths = createAsyncThunk<
    { searchId: number; index: number; segments: RouteSegment[]; times: ReturnType<typeof retimeJourney> },
    number,
    { state: { route: State; search: { walkingSpeedMps: number } } }
>('route/refineWalkPaths', async (index, { getState }) => {
    const { route: { journeys, searchId }, search } = getState();
    const segments = await withWalkPaths(journeys[index].segments, fetchWalkPath);
    // A footpath is rarely as long as the straight line, so the times that rested on it move too.
    return { searchId, index, segments, times: retimeJourney({ ...journeys[index], segments }, search.walkingSpeedMps) };
}, {
    condition: (index, { getState }) => {
        const journey = getState().route.journeys[index];
        return hasWalkRouting && !!journey && !journey.walksRouted;
    },
});

type State = {
    // Bumped whenever the journeys are replaced, so a walk lookup that finishes late can tell it is out of date.
    searchId: number;

    // Every journey found for the current search (the Pareto-optimal set). The bottom sheet lets the user pick between them.
    journeys: GtfsJourney[];
    selectedJourneyIndex: number;

    // The displayed journey is not copied into flat state fields: that held every polyline twice, and Immer and RTK's dev
    // middleware walked both copies. Read it with `selectDisplayedJourney` below.

    loading: boolean;
    error?: string | null;
};

const initialState: State = {
    searchId: 0,
    journeys: [],
    selectedJourneyIndex: 0,
    loading: false,
    error: null,
};

const slice = createSlice({
    name: 'route',
    initialState,
    reducers: {
        /** Directly set a full result (e.g. from a non-thunk source). */
        setRoute(state, action: PayloadAction<GtfsRouteResult>) {
            state.journeys = action.payload.journeys;
            state.searchId += 1;
            state.selectedJourneyIndex = 0;
            state.loading = false;
            state.error = null;
        },
        /** Switch which journey is currently displayed on the map — used by
         *  the bottom sheet when the user taps a different option in the list. */
        selectJourney(state, action: PayloadAction<number>) {
            const idx = action.payload;
            if (idx < 0 || idx >= state.journeys.length) return;
            state.selectedJourneyIndex = idx;
        },
        clearRoute(state) {
            state.journeys = [];
            state.searchId += 1;
            state.selectedJourneyIndex = 0;
            state.error = null;
        },
    },
    extraReducers: builder => {
        builder
            .addCase(computeRoute.pending, s => {
                s.loading = true;
                s.error = null;
            })
            .addCase(computeRoute.fulfilled, (s, a) => {
                s.loading = false;
                s.journeys = a.payload.journeys;
                s.searchId += 1;
                s.selectedJourneyIndex = 0;
            })
            .addCase(refineWalkPaths.fulfilled, (s, a) => {
                const { searchId, index, segments, times } = a.payload;
                if (searchId !== s.searchId) return;
                s.journeys[index].segments = segments;
                if (times) Object.assign(s.journeys[index], times);
                s.journeys[index].totalWalkingMeters = Math.round(
                    segments.filter(seg => seg.type === 'walk').reduce((sum, seg) => sum + segmentMeters(seg), 0),
                );
                s.journeys[index].walksRouted = true;
            })
            .addCase(computeRoute.rejected, (s, a) => {
                s.loading = false;
                s.error = a.payload ?? String(a.error);
            });
    },
});

export const { setRoute, selectJourney, clearRoute } = slice.actions;

/** The journey currently shown on the map (reference-stable: it's the same
 *  object stored in `journeys`, so useSelector doesn't re-render on it). */
export const selectDisplayedJourney = (s: { route: State }): GtfsJourney | undefined =>
    s.route.journeys[s.route.selectedJourneyIndex];
export default slice.reducer;