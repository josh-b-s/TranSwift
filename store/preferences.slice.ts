import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { colorScheme as nativewindColorScheme } from 'nativewind';
import { clampWalkDistance, DEFAULT_MAX_WALK_DISTANCE_M } from '@/constants/walkLimit';
import { clampWeeklyGoal, NO_WEEKLY_GOAL_M } from '@/constants/walkGoal';
import {
    DEFAULT_SPEED_UNIT,
    DEFAULT_THEME_MODE,
    DEFAULT_VEHICLE_SCOPE,
    DEFAULT_WALKING_SPEEDS,
    loadStoredPreferences,
    saveStoredPreferences,
    type SpeedUnit,
    type ThemeMode,
    type VehicleScope,
    type WalkingSpeedOption,
} from '@/services/preferences/preferencesStore';

export type { SpeedUnit, ThemeMode, VehicleScope, WalkingSpeedOption };

type State = {
    themeMode: ThemeMode;
    walkingSpeeds: WalkingSpeedOption[];
    speedUnit: SpeedUnit;
    maxWalkDistanceM: number;
    weeklyGoalM: number;
    vehicleScope: VehicleScope;
    /** True once loadPreferences() has resolved — screens can use this to
     *  avoid flashing default values before the real ones load. */
    loaded: boolean;
};

const initialState: State = {
    themeMode: DEFAULT_THEME_MODE,
    walkingSpeeds: DEFAULT_WALKING_SPEEDS,
    speedUnit: DEFAULT_SPEED_UNIT,
    maxWalkDistanceM: DEFAULT_MAX_WALK_DISTANCE_M,
    weeklyGoalM: NO_WEEKLY_GOAL_M,
    vehicleScope: DEFAULT_VEHICLE_SCOPE,
    loaded: false,
};

// Fire and forget: reducers mutate state through Immer, then call this with the plain values. Not awaited, so a failed
// write doesn't block the UI update. It only logs.
function persist(state: State) {
    saveStoredPreferences({
        themeMode: state.themeMode,
        walkingSpeeds: state.walkingSpeeds,
        speedUnit: state.speedUnit,
        maxWalkDistanceM: state.maxWalkDistanceM,
        weeklyGoalM: state.weeklyGoalM,
        vehicleScope: state.vehicleScope,
    }).catch(err => {
        console.warn('[preferences] failed to persist:', err);
    });
}

/** Call once at app startup (see app/_layout.tsx) — loads the saved file
 *  and applies the saved theme mode to nativewind immediately. */
export const loadPreferences = createAsyncThunk('preferences/load', async () => {
    return loadStoredPreferences();
});

const slice = createSlice({
    name: 'preferences',
    initialState,
    reducers: {
        setThemeMode(state, action: PayloadAction<ThemeMode>) {
            state.themeMode = action.payload;
            nativewindColorScheme.set(action.payload);
            persist(state);
        },
        setSpeedUnit(state, action: PayloadAction<SpeedUnit>) {
            state.speedUnit = action.payload;
            persist(state);
        },
        setVehicleScope(state, action: PayloadAction<VehicleScope>) {
            state.vehicleScope = action.payload;
            persist(state);
        },
        setMaxWalkDistance(state, action: PayloadAction<number>) {
            state.maxWalkDistanceM = clampWalkDistance(action.payload);
            persist(state);
        },
        setWeeklyGoal(state, action: PayloadAction<number>) {
            state.weeklyGoalM = clampWeeklyGoal(action.payload);
            persist(state);
        },
        addWalkingSpeed(state, action: PayloadAction<WalkingSpeedOption>) {
            state.walkingSpeeds.push(action.payload);
            persist(state);
        },
        updateWalkingSpeed(state, action: PayloadAction<{ id: string; label?: string; mps?: number }>) {
            const option = state.walkingSpeeds.find(o => o.id === action.payload.id);
            if (!option) return;
            if (action.payload.label !== undefined) option.label = action.payload.label;
            if (action.payload.mps !== undefined) option.mps = action.payload.mps;
            persist(state);
        },
        removeWalkingSpeed(state, action: PayloadAction<string>) {
            // Always keep at least one preset — the pill needs something to show/cycle.
            if (state.walkingSpeeds.length <= 1) return;
            state.walkingSpeeds = state.walkingSpeeds.filter(o => o.id !== action.payload);
            persist(state);
        },
        resetPreferences(state) {
            state.themeMode = DEFAULT_THEME_MODE;
            state.walkingSpeeds = DEFAULT_WALKING_SPEEDS.map(o => ({ ...o }));
            state.speedUnit = DEFAULT_SPEED_UNIT;
            state.maxWalkDistanceM = DEFAULT_MAX_WALK_DISTANCE_M;
            state.weeklyGoalM = NO_WEEKLY_GOAL_M;
            state.vehicleScope = DEFAULT_VEHICLE_SCOPE;
            nativewindColorScheme.set(DEFAULT_THEME_MODE);
            persist(state);
        },
    },
    extraReducers: (builder) => {
        builder.addCase(loadPreferences.fulfilled, (state, action) => {
            state.themeMode = action.payload.themeMode;
            state.walkingSpeeds = action.payload.walkingSpeeds;
            state.speedUnit = action.payload.speedUnit;
            state.maxWalkDistanceM = action.payload.maxWalkDistanceM;
            state.weeklyGoalM = action.payload.weeklyGoalM;
            state.vehicleScope = action.payload.vehicleScope;
            state.loaded = true;
            nativewindColorScheme.set(action.payload.themeMode);
        });
    },
});

export const {
    setThemeMode,
    setSpeedUnit,
    setMaxWalkDistance,
    setWeeklyGoal,
    setVehicleScope,
    addWalkingSpeed,
    updateWalkingSpeed,
    removeWalkingSpeed,
    resetPreferences,
} = slice.actions;
export default slice.reducer;
