import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRideProgress } from '@/services/trips/rideProgress';

// 0.001 degrees of latitude is about 111 m, so 0.0005 is inside the 100 m radius and 0.002 is well outside it.
const at = (lat: number) => ({ latitude: lat, longitude: 144.9 });
const stops = [-37.80, -37.82, -37.84, -37.86].map(lat => ({ name: 's', ...at(lat) }));

test('starts with every stop after the boarding stop to go', () => {
    assert.equal(createRideProgress(stops).stopsLeft, 3);
});

test('counts down as each stop is reached', () => {
    const progress = createRideProgress(stops);
    assert.equal(progress.update(at(-37.81)), 3);
    assert.equal(progress.update(at(-37.8205)), 2);
    assert.equal(progress.update(at(-37.8405)), 1);
    assert.equal(progress.update(at(-37.8605)), 0);
});

test('catches up when a stop was skipped without a fix', () => {
    const progress = createRideProgress(stops);
    assert.equal(progress.update(at(-37.8405)), 1);
});

test('never counts back up', () => {
    const progress = createRideProgress(stops);
    progress.update(at(-37.8405));
    assert.equal(progress.update(at(-37.8205)), 1);
});
