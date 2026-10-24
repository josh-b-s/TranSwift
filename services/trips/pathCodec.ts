export type Sample = { latitude: number; longitude: number; /** Epoch ms. */ time: number };

/** Start point plus integer deltas, flattened as [dLat, dLon, dTimeMs, ...]. */
export type EncodedPath = { start: [latE6: number, lonE6: number, timeMs: number]; steps: number[] };

// 1e-6 degrees is about 0.11 m, well below GPS noise.
const SCALE = 1e6;

export function encodePath(samples: Sample[]): EncodedPath {
    if (samples.length === 0) throw new Error('Cannot encode an empty path');

    const q = samples.map(s => [Math.round(s.latitude * SCALE), Math.round(s.longitude * SCALE), s.time]);
    const steps: number[] = [];
    for (let i = 1; i < q.length; i++) {
        steps.push(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1], q[i][2] - q[i - 1][2]);
    }
    return { start: [q[0][0], q[0][1], q[0][2]], steps };
}

export function decodePath({ start, steps }: EncodedPath): Sample[] {
    let [lat, lon, time] = start;
    const samples: Sample[] = [{ latitude: lat / SCALE, longitude: lon / SCALE, time }];
    for (let i = 0; i < steps.length; i += 3) {
        lat += steps[i];
        lon += steps[i + 1];
        time += steps[i + 2];
        samples.push({ latitude: lat / SCALE, longitude: lon / SCALE, time });
    }
    return samples;
}
