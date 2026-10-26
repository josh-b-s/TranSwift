import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearestWithin } from '@/services/geo/nearestPoint';

const at = (p: { latitude: number; longitude: number }) => p;
const point = (latitude: number, longitude: number) => ({ latitude, longitude });

test('returns the closest item inside the limit', () => {
    const near = point(-37.8001, 144.9);
    const far = point(-37.8005, 144.9);
    assert.equal(nearestWithin([far, near], point(-37.8, 144.9), 0.001, at), near);
});

test('returns null when nothing is within the limit', () => {
    assert.equal(nearestWithin([point(-37.81, 144.9)], point(-37.8, 144.9), 0.001, at), null);
});

test('counts a degree of longitude as shorter than a degree of latitude', () => {
    // 0.0012 deg east is about 0.00095 deg of latitude at this latitude, so it is inside a 0.001 limit.
    const east = point(-37.8, 144.9012);
    assert.equal(nearestWithin([east], point(-37.8, 144.9), 0.001, at), east);
});
