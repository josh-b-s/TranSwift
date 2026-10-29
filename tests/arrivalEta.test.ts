import { test } from 'node:test';
import assert from 'node:assert/strict';
import { secondsToArrival } from '@/services/trips/arrivalEta';

test('uses distance over speed while moving', () => {
    assert.equal(secondsToArrival(300, 10, 999_999, 0), 30);
});

test('falls back to the arrival time when stopped, slow or without a speed', () => {
    assert.equal(secondsToArrival(300, 0, 90_000, 30_000), 60);
    assert.equal(secondsToArrival(300, 1, 90_000, 30_000), 60);
    assert.equal(secondsToArrival(300, -1, 90_000, 30_000), 60);
    assert.equal(secondsToArrival(300, null, 90_000, 30_000), 60);
});

test('is negative once the arrival time has passed', () => {
    assert.equal(secondsToArrival(300, undefined, 10_000, 40_000), -30);
});

test('is null with neither a usable speed nor an arrival time', () => {
    assert.equal(secondsToArrival(300, 0.5, undefined, 0), null);
    assert.equal(secondsToArrival(300, null, undefined, 0), null);
});
