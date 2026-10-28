import { haversineMeters } from '@/services/geo/geoUtil';
import type { Sample } from './pathCodec';

export type Split = { distanceM: number; durationS: number; avgSpeedMps: number };

// A last stretch shorter than this says little about pace.
const MIN_PARTIAL_M = 50;

const metersBetween = (a: Sample, b: Sample) =>
    haversineMeters({ lat: a.latitude, lon: a.longitude }, { lat: b.latitude, lon: b.longitude });

const makeSplit = (distanceM: number, durationS: number): Split => ({
    distanceM,
    durationS,
    avgSpeedMps: durationS > 0 ? distanceM / durationS : 0,
});

/**
 * Walking time per `splitM` of distance, across all the walks of a trip in order. The time spent riding between
 * walks is not counted. A split that crosses a sample is cut in proportion, and a short last stretch is kept
 * as a partial split.
 */
export function walkSplits(paths: Sample[][], splitM: number): Split[] {
    const splits: Split[] = [];
    let distanceM = 0;
    let durationS = 0;

    for (const path of paths) {
        for (let i = 1; i < path.length; i++) {
            let segmentM = metersBetween(path[i - 1], path[i]);
            let segmentS = (path[i].time - path[i - 1].time) / 1000;
            if (segmentS <= 0) continue;

            while (distanceM + segmentM >= splitM) {
                const takeM = splitM - distanceM;
                const takeS = segmentS * (takeM / segmentM);
                splits.push(makeSplit(splitM, durationS + takeS));
                segmentM -= takeM;
                segmentS -= takeS;
                distanceM = 0;
                durationS = 0;
            }
            distanceM += segmentM;
            durationS += segmentS;
        }
    }

    if (distanceM >= MIN_PARTIAL_M) splits.push(makeSplit(distanceM, durationS));
    return splits;
}
