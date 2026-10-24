import type { LatLng } from '@/services/places/places';
import { decodeLine } from './lineCodec';
import { decodePath } from './pathCodec';
import type { SavedTrip } from './tripStore';

export type MapLine = { kind: 'walk' | 'ride'; coords: LatLng[]; color?: string };

/** The rider's own path on walks and the line followed on rides, in trip order. */
export function tripLines(trip: SavedTrip): MapLine[] {
    return trip.legs.map((leg): MapLine =>
        leg.kind === 'walk'
            ? { kind: 'walk', coords: decodePath(leg.path).map(({ latitude, longitude }) => ({ latitude, longitude })) }
            : { kind: 'ride', coords: decodeLine(leg.line), color: leg.routeColor });
}
