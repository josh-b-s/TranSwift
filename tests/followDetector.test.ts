import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectOnRoute } from '@/services/geo/routeProjection';
import { createFollowDetector } from '@/services/trips/followDetector';

// One degree of latitude is about 111.2 km, so 0.001 is about 111 m.
const M_PER_DEG_LAT = 111_195;
const north = (m: number) => ({ latitude: -37.8 + m / M_PER_DEG_LAT, longitude: 144.9 });
const fix = (latitude: number, longitude: number, accuracyM: number | null = 5) => ({ latitude, longitude, accuracyM });
// A straight route running north for 500 m.
const route = [north(0), north(250), north(500)];

test('projects a point on the line to its distance along it', () => {
    const hit = projectOnRoute(route, north(300));
    assert.ok(hit);
    assert.ok(Math.abs(hit.alongM - 300) < 1);
    assert.ok(hit.offRouteM < 1);
});

test('measures how far a point is from the line', () => {
    // 0.0003 deg of longitude is about 26 m at this latitude.
    const hit = projectOnRoute(route, { latitude: north(100).latitude, longitude: 144.9003 });
    assert.ok(hit);
    assert.ok(Math.abs(hit.offRouteM - 26.4) < 1);
    assert.ok(Math.abs(hit.alongM - 100) < 1);
});

test('clamps to the end of the line', () => {
    const hit = projectOnRoute(route, north(600));
    assert.ok(hit);
    assert.ok(Math.abs(hit.alongM - 500) < 1);
    assert.ok(Math.abs(hit.offRouteM - 100) < 1);
});

test('has no projection onto a single point', () => {
    assert.equal(projectOnRoute([north(0)], north(10)), null);
});

test('does not start while the rider stands near the start', () => {
    const detector = createFollowDetector(route);
    assert.equal(detector.update(fix(north(0).latitude, 144.9)), false);
    assert.equal(detector.update(fix(north(20).latitude, 144.9)), false);
});

test('starts once the rider has moved far enough along the route', () => {
    const detector = createFollowDetector(route);
    assert.equal(detector.update(fix(north(10).latitude, 144.9)), false);
    assert.equal(detector.update(fix(north(40).latitude, 144.9)), false);
    assert.equal(detector.update(fix(north(65).latitude, 144.9)), true);
});

test('does not start from walking backwards along the route', () => {
    const detector = createFollowDetector(route);
    detector.update(fix(north(200).latitude, 144.9));
    assert.equal(detector.update(fix(north(100).latitude, 144.9)), false);
});

test('does not start from movement away from the route', () => {
    const detector = createFollowDetector(route);
    detector.update(fix(north(10).latitude, 144.9));
    // About 90 m east of the line.
    assert.equal(detector.update(fix(north(100).latitude, 144.901)), false);
});

test('leaving the route forgets where the rider joined it', () => {
    const detector = createFollowDetector(route);
    detector.update(fix(north(10).latitude, 144.9));
    detector.update(fix(north(100).latitude, 144.901));
    assert.equal(detector.update(fix(north(120).latitude, 144.9)), false);
});

test('ignores fixes that are too inaccurate or have no accuracy', () => {
    const detector = createFollowDetector(route);
    detector.update(fix(north(10).latitude, 144.9));
    assert.equal(detector.update(fix(north(200).latitude, 144.9, 60)), false);
    assert.equal(detector.update(fix(north(200).latitude, 144.9, null)), false);
});
