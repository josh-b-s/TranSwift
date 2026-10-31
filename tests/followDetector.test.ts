import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFollowDetector } from '@/services/trips/followDetector';

// One degree of latitude is about 111.2 km, so 0.001 is about 111 m.
const M_PER_DEG_LAT = 111_195;
const point = (northM: number, eastM = 0) => ({
    latitude: -37.8 + northM / M_PER_DEG_LAT,
    longitude: 144.9 + eastM / (M_PER_DEG_LAT * Math.cos((37.8 * Math.PI) / 180)),
});
const fix = (northM: number, eastM = 0, accuracyM: number | null = 5) => ({ ...point(northM, eastM), accuracyM });
// The journey starts at the origin and its first step ends 500 m north.
const detector = () => createFollowDetector(point(0), point(500));

test('does not start while the rider stands at the start', () => {
    const d = detector();
    assert.equal(d.update(fix(0)), false);
    assert.equal(d.update(fix(20)), false);
});

test('starts once the rider has walked towards the first step end', () => {
    const d = detector();
    assert.equal(d.update(fix(10)), false);
    assert.equal(d.update(fix(40)), false);
    assert.equal(d.update(fix(65)), true);
});

test('does not start from walking the other way', () => {
    const d = detector();
    d.update(fix(10));
    assert.equal(d.update(fix(-60)), false);
});

test('does not start from wandering sideways', () => {
    const d = detector();
    d.update(fix(0));
    assert.equal(d.update(fix(0, 60)), false);
});

test('ignores a rider who is not near the start', () => {
    const d = detector();
    assert.equal(d.update(fix(300)), false);
    assert.equal(d.update(fix(400)), false);
});

test('leaving the start without setting off forgets where the rider was', () => {
    const d = detector();
    d.update(fix(0));
    d.update(fix(0, 200));
    // Back near the start but 20 m up the road: a fresh anchor, so 50 m more is needed.
    assert.equal(d.update(fix(20)), false);
    assert.equal(d.update(fix(60)), false);
    assert.equal(d.update(fix(75)), true);
});

test('ignores fixes that are too inaccurate or have no accuracy', () => {
    const d = detector();
    d.update(fix(10));
    assert.equal(d.update(fix(200, 0, 60)), false);
    assert.equal(d.update(fix(200, 0, null)), false);
});

test('a poor first fix does not set the point the rider is measured from', () => {
    const d = detector();
    d.update(fix(70, 0, 60));
    d.update(fix(10));
    assert.equal(d.update(fix(40)), false);
});
