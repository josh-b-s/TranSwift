import type { GtfsJourney } from '@/services/gtfs/router/routeTypes';

export type BarPiece =
    | { kind: 'ride'; weight: number; leg: GtfsJourney['legs'][number] }
    /** Time between rides: walking and waiting, which the timestamps do not tell apart. `walkSeconds` is set where the route has a walk there. */
    | { kind: 'gap'; weight: number; walkSeconds?: number };

/** Seconds since the service day began. GTFS hours can pass 24 for trips after midnight. */
function toSeconds(time: string | undefined): number | null {
    if (!time) return null;
    const [h, m, s = 0] = time.split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) && Number.isFinite(s) ? h * 3600 + m * 60 + s : null;
}

/**
 * A journey cut into rides and the gaps between them, each weighted by its time, for drawing as one proportional bar.
 * Without times on every leg the rides share the bar equally.
 * `walkSeconds` is from walkSecondsByGap: the walk before each leg, then the walk after the last.
 */
export function journeyBar(journey: GtfsJourney, walkSeconds: (number | null)[] = []): BarPiece[] {
    const start = toSeconds(journey.departureTime);
    const end = toSeconds(journey.arrivalTime);
    const timed = journey.legs.map(leg => ({ leg, from: toSeconds(leg.departureTime), to: toSeconds(leg.arrivalTime) }));

    if (start === null || end === null || timed.some(t => t.from === null || t.to === null)) {
        return journey.legs.map(leg => ({ kind: 'ride', weight: 1, leg }));
    }

    const pieces: BarPiece[] = [];
    let cursor = start;
    for (const [i, { leg, from, to }] of timed.entries()) {
        if (from! > cursor) pieces.push({ kind: 'gap', weight: from! - cursor, walkSeconds: walkSeconds[i] ?? undefined });
        pieces.push({ kind: 'ride', weight: Math.max(60, to! - from!), leg });
        cursor = Math.max(cursor, to!);
    }
    if (end > cursor) pieces.push({ kind: 'gap', weight: end - cursor, walkSeconds: walkSeconds[timed.length] ?? undefined });
    return pieces;
}
