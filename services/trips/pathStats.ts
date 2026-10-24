import { haversineMeters } from '@/services/geo/geoUtil';
import type { Sample } from './pathCodec';

// Faster than a sprint is GPS error or a vehicle.
export const MAX_PLAUSIBLE_MPS = 10;

// Top speed is the fastest stretch of at least this long, since single GPS fixes spike.
const TOP_SPEED_WINDOW_MS = 10_000;

export type PathStats = { distanceM: number; durationS: number; avgSpeedMps: number; topSpeedMps: number };

export function pathStats(samples: Sample[]): PathStats {
    const n = samples.length;
    const cumulativeM = [0];
    for (let i = 1; i < n; i++) {
        cumulativeM.push(cumulativeM[i - 1] + haversineMeters(
            { lat: samples[i - 1].latitude, lon: samples[i - 1].longitude },
            { lat: samples[i].latitude, lon: samples[i].longitude },
        ));
    }
    const distanceM = cumulativeM[n - 1] ?? 0;
    const durationS = n > 1 ? (samples[n - 1].time - samples[0].time) / 1000 : 0;

    let topSpeedMps = 0;
    let end = 0;
    for (let start = 0; start < n; start++) {
        end = Math.max(end, start);
        while (end < n && samples[end].time - samples[start].time < TOP_SPEED_WINDOW_MS) end++;
        if (end >= n) break;
        const mps = (cumulativeM[end] - cumulativeM[start]) / ((samples[end].time - samples[start].time) / 1000);
        if (mps <= MAX_PLAUSIBLE_MPS && mps > topSpeedMps) topSpeedMps = mps;
    }

    return { distanceM, durationS, avgSpeedMps: durationS > 0 ? distanceM / durationS : 0, topSpeedMps };
}
