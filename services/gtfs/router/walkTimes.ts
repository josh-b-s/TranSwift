import { haversineMeters } from '@/services/geo/geoUtil';
import type { GtfsJourney, RouteSegment } from '@/services/gtfs/router/routeTypes';

const toSeconds = (time: string | undefined) => {
    if (!time) return null;
    const [h, m, s = 0] = time.split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) && Number.isFinite(s) ? h * 3600 + m * 60 + s : null;
};

/** How long a walk takes: its own times when the router gave them, otherwise its length at the rider's pace. */
function walkSeconds(segment: RouteSegment, speedMps: number): number {
    const from = toSeconds(segment.departureTime);
    const to = toSeconds(segment.arrivalTime);
    if (from !== null && to !== null && to > from) return to - from;
    let metres = 0;
    for (let i = 1; i < segment.coords.length; i++) {
        const a = segment.coords[i - 1];
        const b = segment.coords[i];
        metres += haversineMeters({ lat: a.latitude, lon: a.longitude }, { lat: b.latitude, lon: b.longitude });
    }
    return metres / speedMps;
}

/**
 * Walking time in each gap between rides: slot i is the walk before leg i, and the last slot the walk after the final leg.
 * A slot with no walk is null. All null when the segments do not line up with the legs.
 */
export function walkSecondsByGap(journey: GtfsJourney, speedMps: number): (number | null)[] {
    const slots: (number | null)[] = journey.legs.map(() => null).concat(null);
    const rides = journey.segments.filter(s => s.type === 'transit').length;
    if (rides !== journey.legs.length || speedMps <= 0) return slots;

    let ridesSeen = 0;
    for (const segment of journey.segments) {
        if (segment.type === 'transit') ridesSeen++;
        else slots[ridesSeen] = (slots[ridesSeen] ?? 0) + walkSeconds(segment, speedMps);
    }
    return slots;
}
