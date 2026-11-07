import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requiredSpeedMps, speedVerdict } from '@/services/trips/requiredSpeed';

test('required speed is distance over time left', () => {
    assert.equal(requiredSpeedMps(300, 160_000, 100_000), 5);
});

test('has no required speed once the deadline has passed or nothing is left to cover', () => {
    assert.equal(requiredSpeedMps(300, 100_000, 100_000), null);
    assert.equal(requiredSpeedMps(300, 90_000, 100_000), null);
    assert.equal(requiredSpeedMps(0, 160_000, 100_000), null);
});

test('slower than required is late by the shortfall', () => {
    assert.deepEqual(speedVerdict(1, 1.5), { onTime: false, marginMps: -0.5 });
});

test('matching or beating the required speed is on time', () => {
    assert.equal(speedVerdict(1.5, 1.5).onTime, true);
    assert.deepEqual(speedVerdict(2, 1.5), { onTime: true, marginMps: 0.5 });
});
