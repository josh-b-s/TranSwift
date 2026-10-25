/**
 * preferencesStore.ts: on-disk persistence for user preferences (theme mode, the walking-speed presets Search.tsx cycles through).
 * One JSON file, like gtfsDbRegistry.ts, since it is a handful of values. store/preferences.slice.ts owns the redux side and
 * calls this to load at startup and persist on change. Nothing else should touch PREFS_PATH.
 */

import * as FileSystem from 'expo-file-system/legacy';

export type ThemeMode = 'system' | 'light' | 'dark';

export type SpeedUnit = 'kmh' | 'mph';

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
};

export const DEFAULT_THEME_MODE: ThemeMode = 'system';
export const DEFAULT_SPEED_UNIT: SpeedUnit = 'kmh';

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
        };
    } catch {
        // No file yet (fresh install) — defaults, not an error.
        return { themeMode: DEFAULT_THEME_MODE, walkingSpeeds: DEFAULT_WALKING_SPEEDS, speedUnit: DEFAULT_SPEED_UNIT };
    }
}

export async function saveStoredPreferences(prefs: StoredPreferences): Promise<void> {
    await FileSystem.writeAsStringAsync(PREFS_PATH, JSON.stringify(prefs, null, 2));
}
