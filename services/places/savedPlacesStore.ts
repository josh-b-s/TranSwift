/**
 * savedPlacesStore.ts: on-disk persistence for saved places and recent searches. One JSON file, like preferencesStore.ts.
 * store/savedPlaces.slice.ts owns the redux side and calls this to load at startup and persist on change.
 */

import * as FileSystem from 'expo-file-system/legacy';
import type { SearchPlace } from '@/services/places/places';
import type { SavedPlace } from '@/services/places/savedPlaces';

export type StoredPlaces = {
    saved: SavedPlace[];
    recents: SearchPlace[];
};

const PLACES_PATH = `${FileSystem.documentDirectory}saved-places.json`;

export async function loadStoredPlaces(): Promise<StoredPlaces> {
    try {
        const parsed = JSON.parse(await FileSystem.readAsStringAsync(PLACES_PATH)) as Partial<StoredPlaces>;
        return {
            saved: Array.isArray(parsed.saved) ? parsed.saved : [],
            recents: Array.isArray(parsed.recents) ? parsed.recents : [],
        };
    } catch {
        // No file yet (fresh install) is not an error.
        return { saved: [], recents: [] };
    }
}

export async function saveStoredPlaces(places: StoredPlaces): Promise<void> {
    await FileSystem.writeAsStringAsync(PLACES_PATH, JSON.stringify(places));
}
