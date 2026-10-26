import type { LatLng, SearchPlace } from '@/services/places/places';
import type { RepoStop } from '@/services/gtfs/core/stopRepo';

export const CURRENT_LOCATION_ID = 'current-location';

// The coordinates are placeholders. The live position is read from the store
// when a route is requested, so a swapped or reused value never goes stale.
export const CURRENT_LOCATION: SearchPlace = {
    place_id: CURRENT_LOCATION_ID,
    name: 'Current location',
    address: '',
    latitude: 0,
    longitude: 0,
};

export const isCurrentLocation = (place: SearchPlace): boolean => place.place_id === CURRENT_LOCATION_ID;

export function placeCoords(place: SearchPlace, userLocation: LatLng | null): LatLng | null {
    if (isCurrentLocation(place)) return userLocation;
    return { latitude: place.latitude, longitude: place.longitude };
}

/** A transit stop as a place, so it can be saved and used as a start or end. */
export function stopToPlace(stop: RepoStop): SearchPlace {
    return {
        place_id: `stop:${stop.stop_pk}`,
        name: stop.stop_name,
        address: 'Transit stop',
        latitude: stop.stop_lat,
        longitude: stop.stop_lon,
    };
}

export function makePinPlace({ latitude, longitude }: LatLng): SearchPlace {
    return {
        place_id: `pin:${latitude},${longitude}`,
        name: 'Dropped pin',
        address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
        latitude,
        longitude,
    };
}
