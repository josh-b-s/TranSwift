import { haversineMeters } from '@/services/geo/geoUtil';
import type { LatLng } from '@/services/places/places';
import { decodePath } from './pathCodec';
import type { SavedTrip } from './tripStore';

// One fix per second is far finer than a map can show, and every point costs a polyline vertex.
const MIN_GAP_M = 8;

/** Keeps a point only once it is `minGapM` from the last kept one, and always keeps the end. */
export function thinCoords(coords: LatLng[], minGapM: number): LatLng[] {
    if (coords.length < 2) return coords;
    const kept = [coords[0]];
    for (let i = 1; i < coords.length - 1; i++) {
        const last = kept[kept.length - 1];
        const gap = haversineMeters(
            { lat: last.latitude, lon: last.longitude },
            { lat: coords[i].latitude, lon: coords[i].longitude },
        );
        if (gap >= minGapM) kept.push(coords[i]);
    }
    kept.push(coords[coords.length - 1]);
    return kept;
}

/** Every recorded walk across the given trips as a thinned line. Rides are left out: they are not the rider's own path. */
export function heatmapLines(trips: SavedTrip[], minGapM = MIN_GAP_M): LatLng[][] {
    return trips.flatMap(trip =>
        trip.legs.flatMap(leg => {
            if (leg.kind !== 'walk') return [];
            const coords = decodePath(leg.path).map(({ latitude, longitude }) => ({ latitude, longitude }));
            return coords.length > 1 ? [thinCoords(coords, minGapM)] : [];
        }),
    );
}
