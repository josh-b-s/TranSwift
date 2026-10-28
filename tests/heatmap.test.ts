import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heatmapLines, thinCoords } from '@/services/trips/heatmap';
import { encodePath } from '@/services/trips/pathCodec';
import type { SavedTrip } from '@/services/trips/tripStore';

// 0.0001 degrees of latitude is about 11 m.
const line = (n: number) => Array.from({ length: n }, (_, i) => ({ latitude: -37.8 + i * 0.0001, longitude: 144.9 }));

test('thinning keeps the ends and drops points closer than the gap', () => {
    const thinned = thinCoords(line(11), 25);
    assert.deepEqual(thinned[0], line(11)[0]);
    assert.deepEqual(thinned[thinned.length - 1], line(11)[10]);
    assert.ok(thinned.length < 11 && thinned.length >= 4);
    assert.equal(thinCoords(line(1), 25).length, 1);
});

test('collects walks from every trip and skips rides and one-point walks', () => {
    const walk = (n: number) => ({
        kind: 'walk' as const, stepIndex: 0, from: 'A', to: 'B',
        path: encodePath(line(n).map((c, i) => ({ ...c, time: i * 1000 }))),
    });
    const ride = { kind: 'ride' as const, stepIndex: 1, from: 'B', to: 'C', routeName: '96', routeType: 0, line: '' };
    const trips: SavedTrip[] = [
        { startedAt: 1, records: [], legs: [walk(5), ride, walk(1)] },
        { startedAt: 2, records: [], legs: [walk(4)] },
    ];
    assert.equal(heatmapLines(trips, 1).length, 2);
});
