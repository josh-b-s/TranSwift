import type { SearchPlace } from '@/services/places/places';

/** A place the user pinned. The label is theirs to rename ("Home", "Work"); the place keeps its own name. */
export type SavedPlace = SearchPlace & { label: string };

export const MAX_RECENTS = 8;

export const isSaved = (saved: SavedPlace[], placeId: string): boolean => saved.some(p => p.place_id === placeId);

export const isRecent = (recents: SearchPlace[], placeId: string): boolean => recents.some(p => p.place_id === placeId);

/** Saves the place, or removes it if it is already saved. */
export function toggleSaved(saved: SavedPlace[], place: SearchPlace): SavedPlace[] {
    if (isSaved(saved, place.place_id)) return saved.filter(p => p.place_id !== place.place_id);
    return [...saved, { ...place, label: place.name }];
}

/** A blank label is ignored, so a saved place always has something to show. */
export function renameSaved(saved: SavedPlace[], placeId: string, label: string): SavedPlace[] {
    const trimmed = label.trim();
    if (!trimmed) return saved;
    return saved.map(p => (p.place_id === placeId ? { ...p, label: trimmed } : p));
}

/** Most recent first, one entry per place, capped. Saved places are not repeated here. */
export function addRecent(recents: SearchPlace[], saved: SavedPlace[], place: SearchPlace): SearchPlace[] {
    if (isSaved(saved, place.place_id)) return recents;
    return [place, ...recents.filter(p => p.place_id !== place.place_id)].slice(0, MAX_RECENTS);
}

/** What an empty search field offers: saved places under their labels, then recents. */
export function buildSuggestions(saved: SavedPlace[], recents: SearchPlace[], excludeId?: string): SearchPlace[] {
    const named = saved.map(({ label, ...place }) => ({ ...place, name: label }));
    const unsaved = recents.filter(p => !isSaved(saved, p.place_id));
    return [...named, ...unsaved].filter(p => p.place_id !== excludeId);
}

/** Saved places and recents that contain the query in their label, name or address, saved ones first. */
export function matchPlaces(saved: SavedPlace[], recents: SearchPlace[], query: string): SearchPlace[] {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return buildSuggestions(saved, recents).filter(p => `${p.name} ${p.address}`.toLowerCase().includes(needle));
}

/** Local matches first, then API results, one entry per place. */
export function mergeResults(local: SearchPlace[], remote: SearchPlace[]): SearchPlace[] {
    const seen = new Set(local.map(p => p.place_id));
    return [...local, ...remote.filter(p => !seen.has(p.place_id))];
}

/**
 * Updates stored places with fresher data from an API search (same place_id). Saved labels are kept.
 * Returns the same array when nothing changed, so callers can skip a write.
 */
export function refreshFromResults<T extends SearchPlace>(stored: T[], results: SearchPlace[]): T[] {
    const byId = new Map(results.map(p => [p.place_id, p]));
    let changed = false;
    const next = stored.map(p => {
        const fresh = byId.get(p.place_id);
        if (!fresh) return p;
        if (fresh.name === p.name && fresh.address === p.address
            && fresh.latitude === p.latitude && fresh.longitude === p.longitude) return p;
        changed = true;
        return { ...p, name: fresh.name, address: fresh.address, latitude: fresh.latitude, longitude: fresh.longitude };
    });
    return changed ? next : stored;
}
