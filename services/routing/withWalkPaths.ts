import type { LatLng } from '@/services/places/places';
import type { RouteSegment } from '@/services/gtfs/router/routeTypes';

type PathFetcher = (from: LatLng, to: LatLng) => Promise<LatLng[]>;

/** Replaces each walk's straight line with a footpath. A walk whose request fails keeps its straight line. */
export async function withWalkPaths(segments: RouteSegment[], fetchPath: PathFetcher): Promise<RouteSegment[]> {
    return Promise.all(segments.map(async segment => {
        if (segment.type !== 'walk') return segment;
        const from = segment.coords[0];
        const to = segment.coords[segment.coords.length - 1];
        try {
            const path = await fetchPath(from, to);
            // The service snaps to the nearest road, so the exact endpoints keep the line meeting its markers.
            return { ...segment, coords: [from, ...path, to] };
        } catch (err) {
            console.warn('[walkPaths] keeping straight line:', err);
            return segment;
        }
    }));
}
