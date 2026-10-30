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

// Past this many vertices in total the map slows down, so a long history is thinned harder instead of drawn in full.
const MAX_VERTICES = 20_000;
// Thinning stops doubling the gap here; a walk keeps at least its ends.
const MAX_GAP_M = 128;

/**
 * Every recorded walk across the given trips as a thinned line. Rides are left out: they are not the rider's own
 * path. When the lines would hold more than `maxVertices` points in all, the gap doubles until they fit.
 */
export function heatmapLines(trips: SavedTrip[], minGapM = MIN_GAP_M, maxVertices = MAX_VERTICES): LatLng[][] {
    const paths = trips
        .flatMap(trip => trip.legs.flatMap(leg => (leg.kind === 'walk' ? [decodePath(leg.path)] : [])))
        .map(path => path.map(({ latitude, longitude }) => ({ latitude, longitude })))
        .filter(path => path.length > 1);

    for (let gap = minGapM; ; gap *= 2) {
        const lines = paths.map(path => thinCoords(path, gap));
        const vertices = lines.reduce((sum, line) => sum + line.length, 0);
        if (vertices <= maxVertices || gap >= MAX_GAP_M) return lines;
    }
}
