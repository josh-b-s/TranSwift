import type { LatLng } from '@/services/db/sqliteDb';

/**
 * The item closest to `point`, if it is within `maxLatDeg` (a distance in degrees of latitude).
 * Longitude differences are shrunk by cos(latitude) so the distance is the same in every direction.
 */
export function nearestWithin<T>(items: T[], point: LatLng, maxLatDeg: number, position: (item: T) => LatLng): T | null {
    const lonScale = Math.cos((point.latitude * Math.PI) / 180);
    let best: T | null = null;
    let bestDistance = maxLatDeg;
    for (const item of items) {
        const at = position(item);
        const distance = Math.hypot(at.latitude - point.latitude, (at.longitude - point.longitude) * lonScale);
        if (distance <= bestDistance) {
            best = item;
            bestDistance = distance;
        }
    }
    return best;
}
