import type { Sample } from './pathCodec';
import { windowSpeeds, type TimedSpeed } from './speedProfile';

export type TrackPoint = { atS: number; mps: number; latitude: number; longitude: number };

const walkSeconds = (path: Sample[]) => (path.length > 1 ? (path[path.length - 1].time - path[0].time) / 1000 : 0);

/** Linear between the two neighbours of `atS`, held flat beyond the ends. Zero with no speeds. */
function speedAt(speeds: TimedSpeed[], atS: number): number {
    if (speeds.length === 0) return 0;
    const next = speeds.findIndex(s => s.atS >= atS);
    if (next === 0) return speeds[0].mps;
    if (next === -1) return speeds[speeds.length - 1].mps;
    const a = speeds[next - 1];
    const b = speeds[next];
    return b.atS === a.atS ? b.mps : a.mps + ((b.mps - a.mps) * (atS - a.atS)) / (b.atS - a.atS);
}

function positionAt(path: Sample[], atS: number): Pick<TrackPoint, 'latitude' | 'longitude'> {
    const time = path[0].time + atS * 1000;
    const next = path.findIndex(s => s.time >= time);
    if (next <= 0) return path[Math.max(next, 0)];
    const a = path[next - 1];
    const b = path[next];
    const t = b.time === a.time ? 0 : (time - a.time) / (b.time - a.time);
    return { latitude: a.latitude + (b.latitude - a.latitude) * t, longitude: a.longitude + (b.longitude - a.longitude) * t };
}

/**
 * Walking speed and position at `count` evenly spaced moments over the trip's walking time, walks placed end to end
 * as in speedProfile. Empty when nothing was walked.
 */
export function speedTrack(paths: Sample[][], count: number): TrackPoint[] {
    const walks = paths.filter(p => walkSeconds(p) > 0).map(path => ({ path, durationS: walkSeconds(path), speeds: windowSpeeds(path) }));
    const totalS = walks.reduce((sum, w) => sum + w.durationS, 0);
    if (totalS <= 0 || count < 2) return [];

    return Array.from({ length: count }, (_, i) => {
        const atS = (i / (count - 1)) * totalS;
        let walkStartS = 0;
        const walk = walks.find((w, n) => {
            if (n === walks.length - 1 || atS <= walkStartS + w.durationS) return true;
            walkStartS += w.durationS;
            return false;
        })!;
        const localS = Math.min(atS - walkStartS, walk.durationS);
        return { atS, mps: speedAt(walk.speeds, localS), ...positionAt(walk.path, localS) };
    });
}

/** The point under a slider at `fraction` from 0 to 1 along the track. */
export function pointAt(track: TrackPoint[], fraction: number): TrackPoint {
    const clamped = Math.min(1, Math.max(0, fraction));
    return track[Math.round(clamped * (track.length - 1))];
}
