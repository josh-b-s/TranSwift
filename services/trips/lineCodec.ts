import polyline from '@mapbox/polyline';
import type { LatLng } from '@/services/places/places';

// Same 1e-6 degree grid as pathCodec.
const PRECISION = 6;

export function encodeLine(coords: LatLng[]): string {
    return polyline.encode(coords.map(c => [c.latitude, c.longitude]), PRECISION);
}

export function decodeLine(line: string): LatLng[] {
    return polyline.decode(line, PRECISION).map(([latitude, longitude]) => ({ latitude, longitude }));
}
