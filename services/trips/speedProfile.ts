import { haversineMeters } from '@/services/geo/geoUtil';
import type { Sample } from './pathCodec';
import { MAX_PLAUSIBLE_MPS } from './pathStats';

// A single GPS fix is too noisy for a speed, so each point spans at least this long.
const WINDOW_MS = 5_000;

type TimedSpeed = { atS: number; mps: number };

/** Speed over each window of one walk, stamped with its midpoint in seconds from the walk's start. */
function windowSpeeds(path: Sample[]): TimedSpeed[] {
    const out: TimedSpeed[] = [];
    let end = 0;
    for (let start = 0; start < path.length - 1; start++) {
        end = Math.max(end, start + 1);
        while (end < path.length - 1 && path[end].time - path[start].time < WINDOW_MS) end++;
        const elapsedS = (path[end].time - path[start].time) / 1000;
        if (elapsedS <= 0) continue;
        const meters = haversineMeters(
            { lat: path[start].latitude, lon: path[start].longitude },
            { lat: path[end].latitude, lon: path[end].longitude },
        );
        const mps = meters / elapsedS;
        if (mps <= MAX_PLAUSIBLE_MPS) {
            out.push({ atS: ((path[start].time + path[end].time) / 2 - path[0].time) / 1000, mps });
        }
    }
    return out;
}

/**
 * Walking speed as `bars` evenly spaced averages over the trip's walking time, walks placed end to end.
 * A stretch with no usable fix repeats the one before it. Empty when nothing was walked.
 */
export function speedProfile(paths: Sample[][], bars: number): number[] {
    const durations = paths.map(p => (p.length > 1 ? (p[p.length - 1].time - p[0].time) / 1000 : 0));
    const totalS = durations.reduce((sum, d) => sum + d, 0);
    if (totalS <= 0) return [];

    const sums = new Array<number>(bars).fill(0);
    const counts = new Array<number>(bars).fill(0);
    let offsetS = 0;
    paths.forEach((path, i) => {
        for (const { atS, mps } of windowSpeeds(path)) {
            const bar = Math.min(bars - 1, Math.floor(((offsetS + atS) / totalS) * bars));
            sums[bar] += mps;
            counts[bar]++;
        }
        offsetS += durations[i];
    });

    let previous = 0;
    return sums.map((sum, bar) => (previous = counts[bar] > 0 ? sum / counts[bar] : previous));
}
