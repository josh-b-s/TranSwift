import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { SearchPlace } from '@/services/places/places';
import { addRecent, refreshFromResults, renameSaved, type SavedPlace, toggleSaved } from '@/services/places/savedPlaces';
import { searchPlaces } from '@/store/search.slice';
import { loadStoredPlaces, saveStoredPlaces } from '@/services/places/savedPlacesStore';

type State = {
    saved: SavedPlace[];
    recents: SearchPlace[];
};

const initialState: State = { saved: [], recents: [] };

// Fire and forget, like preferences: a failed write is logged and does not block the UI update.
function persist(state: State) {
    saveStoredPlaces({ saved: state.saved, recents: state.recents }).catch(err => {
        console.warn('[savedPlaces] failed to persist:', err);
    });
}

/** Call once at app startup (see app/_layout.tsx). */
export const loadSavedPlaces = createAsyncThunk('savedPlaces/load', loadStoredPlaces);

const slice = createSlice({
    name: 'savedPlaces',
    initialState,
    reducers: {
        toggleSavedPlace(state, action: PayloadAction<SearchPlace>) {
            state.saved = toggleSaved(state.saved, action.payload);
            // A place that just became saved leaves the recents list; one that was unsaved is not added back.
            state.recents = state.recents.filter(p => p.place_id !== action.payload.place_id);
            persist(state);
        },
        renameSavedPlace(state, action: PayloadAction<{ placeId: string; label: string }>) {
            state.saved = renameSaved(state.saved, action.payload.placeId, action.payload.label);
            persist(state);
        },
        addRecentPlace(state, action: PayloadAction<SearchPlace>) {
            state.recents = addRecent(state.recents, state.saved, action.payload);
            persist(state);
        },
    },
    extraReducers: builder => {
        builder
            .addCase(loadSavedPlaces.fulfilled, (state, action) => {
                state.saved = action.payload.saved;
                state.recents = action.payload.recents;
            })
            // Search results carry current coordinates and names, so stored copies of the same places are brought up to date.
            .addCase(searchPlaces.fulfilled, (state, action) => {
                const saved = refreshFromResults(state.saved, action.payload);
                const recents = refreshFromResults(state.recents, action.payload);
                if (saved === state.saved && recents === state.recents) return;
                state.saved = saved;
                state.recents = recents;
                persist(state);
            });
    },
});

export const { toggleSavedPlace, renameSavedPlace, addRecentPlace } = slice.actions;
export default slice.reducer;
