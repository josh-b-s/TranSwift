import type { Region } from 'react-native-maps';
import type { RepoStop } from '@/services/gtfs/core/stopRepo';

/** Zoomed out past this (about 5 km tall) the dots would only be clutter. */
export const MAX_LATITUDE_DELTA = 0.05;
const MAX_STOPS = 150;

/** The stops inside the visible map area, nearest the centre first if there are too many to draw. */
export function stopsInRegion(stops: RepoStop[], region: Region): RepoStop[] {
    if (region.latitudeDelta > MAX_LATITUDE_DELTA) return [];

    const halfLat = region.latitudeDelta / 2;
    const halfLon = region.longitudeDelta / 2;
    const visible = stops.filter(s =>
        Math.abs(s.stop_lat - region.latitude) <= halfLat &&
        Math.abs(s.stop_lon - region.longitude) <= halfLon);
    if (visible.length <= MAX_STOPS) return visible;

    const distance = (s: RepoStop) =>
        (s.stop_lat - region.latitude) ** 2 + (s.stop_lon - region.longitude) ** 2;
    return visible.sort((a, b) => distance(a) - distance(b)).slice(0, MAX_STOPS);
}
