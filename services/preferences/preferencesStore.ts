/**
 * preferencesStore.ts: on-disk persistence for user preferences (theme mode, the walking-speed presets Search.tsx cycles through).
 * One JSON file, like gtfsDbRegistry.ts, since it is a handful of values. store/preferences.slice.ts owns the redux side and
 * calls this to load at startup and persist on change. Nothing else should touch PREFS_PATH.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { clampWalkDistance, DEFAULT_MAX_WALK_DISTANCE_M } from '@/constants/walkLimit';
import { clampWeeklyGoal, NO_WEEKLY_GOAL_M } from '@/constants/walkGoal';

export type ThemeMode = 'system' | 'light' | 'dark';

export type SpeedUnit = 'kmh' | 'mph';

/** Which vehicles the map shows: only those on the routes you are looking at, or every one in view. */
export type VehicleScope = 'routes' | 'nearby';

export type WalkingSpeedOption = {
    id: string;
    label: string;
    /** Meters/second. */
    mps: number;
};

export type StoredPreferences = {
    themeMode: ThemeMode;
    walkingSpeeds: WalkingSpeedOption[];
    speedUnit: SpeedUnit;
    /** Farthest the router may send you on foot, in meters. */
    maxWalkDistanceM: number;
    /** Distance to walk each week, in meters. Zero means no goal. */
    weeklyGoalM: number;
    vehicleScope: VehicleScope;
};

export const DEFAULT_THEME_MODE: ThemeMode = 'system';
export const DEFAULT_SPEED_UNIT: SpeedUnit = 'kmh';
export const DEFAULT_VEHICLE_SCOPE: VehicleScope = 'routes';

// Same three tiers Search.tsx's WALK_SPEED_CYCLE used to hardcode.
export const DEFAULT_WALKING_SPEEDS: WalkingSpeedOption[] = [
    { id: 'slow', label: 'Slow', mps: 0.8 },
    { id: 'normal', label: 'Normal', mps: 1.4 },
    { id: 'fast', label: 'Fast', mps: 1.8 },
];

const PREFS_PATH = `${FileSystem.documentDirectory}preferences.json`;

export async function loadStoredPreferences(): Promise<StoredPreferences> {
    try {
        const raw = await FileSystem.readAsStringAsync(PREFS_PATH);
        const parsed = JSON.parse(raw) as Partial<StoredPreferences>;
        return {
            themeMode: parsed.themeMode ?? DEFAULT_THEME_MODE,
            walkingSpeeds: parsed.walkingSpeeds?.length ? parsed.walkingSpeeds : DEFAULT_WALKING_SPEEDS,
            speedUnit: parsed.speedUnit ?? DEFAULT_SPEED_UNIT,
            maxWalkDistanceM: Number.isFinite(parsed.maxWalkDistanceM)
                ? clampWalkDistance(parsed.maxWalkDistanceM as number)
                : DEFAULT_MAX_WALK_DISTANCE_M,
            weeklyGoalM: Number.isFinite(parsed.weeklyGoalM) ? clampWeeklyGoal(parsed.weeklyGoalM as number) : NO_WEEKLY_GOAL_M,
            vehicleScope: parsed.vehicleScope === 'nearby' ? 'nearby' : DEFAULT_VEHICLE_SCOPE,
        };
    } catch {
        // No file yet (fresh install) — defaults, not an error.
        return {
            themeMode: DEFAULT_THEME_MODE,
            walkingSpeeds: DEFAULT_WALKING_SPEEDS,
            speedUnit: DEFAULT_SPEED_UNIT,
            maxWalkDistanceM: DEFAULT_MAX_WALK_DISTANCE_M,
            weeklyGoalM: NO_WEEKLY_GOAL_M,
            vehicleScope: DEFAULT_VEHICLE_SCOPE,
        };
    }
}

export async function saveStoredPreferences(prefs: StoredPreferences): Promise<void> {
    await FileSystem.writeAsStringAsync(PREFS_PATH, JSON.stringify(prefs, null, 2));
}
