import { test } from 'node:test';
import assert from 'node:assert/strict';
import { walkSplits } from '@/services/trips/tripSplits';
import { speedProfile } from '@/services/trips/speedProfile';
import type { Sample } from '@/services/trips/pathCodec';

// 0.001 degrees of latitude is about 111 m. Walking north at 1 m/s means one sample per 111 s.
const north = (count: number, stepDeg: number, stepMs: number, startMs = 0, lat0 = -37.8): Sample[] =>
    Array.from({ length: count }, (_, i) => ({ latitude: lat0 + i * stepDeg, longitude: 144.9, time: startMs + i * stepMs }));

const near = (actual: number, expected: number, tolerance: number) =>
    assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

test('cuts a split at each kilometre and keeps the remainder', () => {
    // About 1.67 km at 1.4 m/s: each 556 m step takes 400 s.
    const splits = walkSplits([north(4, 0.005, 400_000)], 1000);
    assert.equal(splits.length, 2);
    near(splits[0].distanceM, 1000, 0.001);
    near(splits[0].durationS, 1000 / 1.39, 8);
    near(splits[1].distanceM, 667, 6);
    near(splits[1].avgSpeedMps, splits[0].avgSpeedMps, 0.02);
});

test('drops a last stretch under 50 m and does not count the gap between walks', () => {
    const first = north(2, 0.0045, 300_000); // about 500 m
    const second = north(2, 0.0045, 300_000, 9_000_000, -37.7); // 500 m, a long ride later
    const splits = walkSplits([first, second], 1000);
    assert.equal(splits.length, 1);
    near(splits[0].durationS, 600, 10);
    assert.deepEqual(walkSplits([north(2, 0.0002, 60_000)], 1000), []);
});

test('speedProfile averages speed into even bars over walking time', () => {
    // 111 m every 100 s for the first half, then four times as fast.
    const slow = north(6, 0.001, 100_000);
    const fast = north(6, 0.001, 25_000, 1_000_000, -37.7);
    const profile = speedProfile([slow, fast], 4);
    assert.equal(profile.length, 4);
    near(profile[0], 1.11, 0.05);
    near(profile[3], 4.4, 0.2);
});

test('speedProfile discards implausible speeds and is empty with no walking', () => {
    assert.deepEqual(speedProfile([], 8), []);
    assert.deepEqual(speedProfile([north(1, 0, 0)], 8), []);
    // 111 m in 5 s is 22 m/s, so every window is discarded.
    assert.deepEqual(speedProfile([north(3, 0.001, 5_000)], 2), [0, 0]);
});
