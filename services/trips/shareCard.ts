import { thinCoords } from './heatmap';
import type { MapLine } from './tripLines';

export type CardLine = { kind: MapLine['kind']; color?: string; points: string };

// Closer than this is invisible at card size.
const THIN_GAP_M = 5;

/**
 * Fits the trip's lines into a width by height box, as the `points` string of an SVG polyline. Longitude is
 * scaled by cos(latitude) so the shape is not stretched, and the whole trip is centred in the box.
 */
export function projectLines(lines: MapLine[], width: number, height: number): CardLine[] {
    const all = lines.flatMap(l => l.coords);
    if (all.length === 0) return [];

    const lats = all.map(c => c.latitude);
    const lons = all.map(c => c.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const lonScale = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
    const spanX = (Math.max(...lons) - minLon) * lonScale;
    const spanY = maxLat - minLat;

    // A trip that never moved has no span to fit; draw it at a fixed size in the middle.
    const scale = spanX === 0 && spanY === 0 ? 1 : Math.min(spanX > 0 ? width / spanX : Infinity, spanY > 0 ? height / spanY : Infinity);
    const offsetX = (width - spanX * scale) / 2;
    const offsetY = (height - spanY * scale) / 2;

    return lines.map(line => ({
        kind: line.kind,
        color: line.color,
        points: thinCoords(line.coords, THIN_GAP_M)
            .map(c => `${(offsetX + (c.longitude - minLon) * lonScale * scale).toFixed(1)},${(offsetY + (maxLat - c.latitude) * scale).toFixed(1)}`)
            .join(' '),
    }));
}

export const truncate = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);
