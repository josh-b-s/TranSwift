import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTrip, NO_BESTS } from '@/services/trips/personalBests';
import { encodePath } from '@/services/trips/pathCodec';
import type { WalkLeg } from '@/services/trips/tripStore';

// A straight walk north of `meters` at a steady `mps`, one fix every 10 s. 0.001 degrees of latitude is about 111.2 m.
function walk(bestKey: string | undefined, meters: number, mps: number): WalkLeg {
    const steps = Math.round(meters / (mps * 10));
    const path = Array.from({ length: steps + 1 }, (_, i) => ({
        latitude: -37.8 + ((i * mps * 10) / 111_195),
        longitude: 144.9,
        time: i * 10_000,
    }));
    return { kind: 'walk', stepIndex: 0, from: 'A', to: 'B', bestKey, path: encodePath(path) };
}

test('the first walk between two stops sets a best with nothing to beat', () => {
    const { bests, broken } = applyTrip(NO_BESTS, { startedAt: 1, legs: [walk('A>B', 500, 1.4)] });
    assert.ok(Math.abs(bests.legs['A>B'].avgSpeedMps - 1.4) < 0.05);
    assert.equal(bests.legs['A>B'].startedAt, 1);
    assert.equal(broken[0].kind, 'speed');
    assert.equal((broken[0] as { previousMps: number | null }).previousMps, null);
});

test('only a faster repeat replaces the best', () => {
    const first = applyTrip(NO_BESTS, { startedAt: 1, legs: [walk('A>B', 500, 1.4)] }).bests;
    const slower = applyTrip(first, { startedAt: 2, legs: [walk('A>B', 500, 1.2)] });
    assert.equal(slower.bests.legs['A>B'].startedAt, 1);
    assert.equal(slower.broken.filter(r => r.kind === 'speed').length, 0);

    const faster = applyTrip(first, { startedAt: 3, legs: [walk('A>B', 500, 1.7)] });
    assert.equal(faster.bests.legs['A>B'].startedAt, 3);
    const record = faster.broken.find(r => r.kind === 'speed') as { previousMps: number };
    assert.ok(Math.abs(record.previousMps - 1.4) < 0.05);
});

test('walks without a key, under 100 m, or faster than a person can walk set no speed best', () => {
    const { bests } = applyTrip(NO_BESTS, {
        startedAt: 1,
        legs: [walk(undefined, 500, 1.4), walk('short', 60, 1.4), walk('car', 500, 12)],
    });
    assert.deepEqual(bests.legs, {});
});

test('longest walk counts all walks in the trip and does not mutate the old bests', () => {
    const before = { legs: {}, longestWalkM: 400 };
    const { bests, broken } = applyTrip(before, { startedAt: 1, legs: [walk(undefined, 300, 1.4), walk(undefined, 300, 1.4)] });
    assert.ok(Math.abs(bests.longestWalkM - 600) < 20);
    const record = broken.find(r => r.kind === 'distance') as { previousM: number };
    assert.equal(record.previousM, 400);
    assert.equal(before.longestWalkM, 400);

    const shorter = applyTrip(bests, { startedAt: 2, legs: [walk(undefined, 200, 1.4)] });
    assert.equal(shorter.broken.length, 0);
});
