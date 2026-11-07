import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointAt, speedTrack } from '@/services/trips/speedTrack';
import type { Sample } from '@/services/trips/pathCodec';

// 0.0001 degrees of latitude is about 11.1 m, so a step every 10 s walks at about 1.1 m/s.
const walk = (count: number, stepDeg: number, stepMs: number, startMs = 0, lat0 = -37.8): Sample[] =>
    Array.from({ length: count }, (_, i) => ({ latitude: lat0 + i * stepDeg, longitude: 144.9, time: startMs + i * stepMs }));

const near = (actual: number, expected: number, tolerance: number) =>
    assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

test('is empty when nothing was walked', () => {
    assert.deepEqual(speedTrack([], 10), []);
    assert.deepEqual(speedTrack([walk(1, 0, 0)], 10), []);
});

test('steady walking gives a flat speed from the start to the end of the path', () => {
    const track = speedTrack([walk(13, 0.0001, 10_000)], 5);
    assert.equal(track.length, 5);
    for (const point of track) near(point.mps, 1.11, 0.05);
    near(track[0].latitude, -37.8, 1e-9);
    near(track[4].latitude, -37.8 + 12 * 0.0001, 1e-9);
    near(track[4].atS, 120, 1e-9);
});

test('speed rises where the walker speeds up and the position is interpolated between samples', () => {
    const slow = walk(7, 0.0001, 10_000);
    const fast = walk(7, 0.0003, 10_000, 60_000, slow[6].latitude).slice(1);
    const track = speedTrack([[...slow, ...fast]], 9);
    assert.ok(track[7].mps > track[1].mps * 2);
    near(pointAt(track, 0.5).atS, 60, 1e-9);
    near(pointAt(speedTrack([walk(3, 0.0002, 10_000)], 5), 0.25).latitude, -37.8 + 0.0001, 1e-9);
});

test('walks are placed end to end and the ride between them takes no time', () => {
    const first = walk(7, 0.0001, 10_000);
    const second = walk(7, 0.0002, 10_000, 3_600_000, -37.7);
    const track = speedTrack([first, second], 3);
    near(track[0].latitude, first[0].latitude, 1e-9);
    near(track[2].latitude, second[6].latitude, 1e-9);
    near(track[2].atS, 120, 1e-9);
    assert.ok(track[2].mps > track[0].mps);
});

test('a slider outside the track clamps to its ends', () => {
    const track = speedTrack([walk(7, 0.0001, 10_000)], 4);
    assert.equal(pointAt(track, -1), track[0]);
    assert.equal(pointAt(track, 2), track[3]);
});
