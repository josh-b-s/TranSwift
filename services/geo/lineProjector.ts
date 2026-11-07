import type { LatLng } from '@/services/db/sqliteDb';

const METRES_PER_DEG = 111_320;
// Prefers the stretch of line near the last position, so a line that doubles back is not entered at its far end.
const HINT_PENALTY_PER_M = 0.02;

export type LinePosition = {
    /** How far the point is from the line. */
    distanceM: number;
    /** How far along the line from its start the nearest point is. */
    alongM: number;
};

/** Measures points against a line, so the same line can be used for many fixes. A line of fewer than 2 points measures nothing. */
export function createLineProjector(line: LatLng[]) {
    const cosLat = line.length > 0 ? Math.cos((line[0].latitude * Math.PI) / 180) : 1;
    const toXY = (p: LatLng) => ({ x: p.longitude * METRES_PER_DEG * cosLat, y: p.latitude * METRES_PER_DEG });
    const xy = line.map(toXY);
    const startAlongM: number[] = [0];
    for (let i = 1; i < xy.length; i++) {
        startAlongM.push(startAlongM[i - 1] + Math.hypot(xy[i].x - xy[i - 1].x, xy[i].y - xy[i - 1].y));
    }

    return {
        lengthM: startAlongM[startAlongM.length - 1] ?? 0,

        /** `hintAlongM` is where the previous point was, to settle which part of a doubling-back line this one is on. */
        project(point: LatLng, hintAlongM: number | null = null): LinePosition | null {
            const p = toXY(point);
            let best: LinePosition | null = null;
            let bestCost = Infinity;
            for (let i = 1; i < xy.length; i++) {
                const a = xy[i - 1];
                const dx = xy[i].x - a.x;
                const dy = xy[i].y - a.y;
                const lenSq = dx * dx + dy * dy;
                const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
                const distanceM = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
                const alongM = startAlongM[i - 1] + t * Math.sqrt(lenSq);
                const cost = distanceM + (hintAlongM === null ? 0 : HINT_PENALTY_PER_M * Math.abs(alongM - hintAlongM));
                if (cost < bestCost) {
                    bestCost = cost;
                    best = { distanceM, alongM };
                }
            }
            return best;
        },
    };
}
