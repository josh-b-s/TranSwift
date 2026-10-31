import { test } from 'node:test';
import assert from 'node:assert/strict';
import { walkSecondsByGap } from '@/services/gtfs/router/walkTimes';
import type { GtfsJourney, RouteSegment } from '@/services/gtfs/router/routeTypes';

// About 111 m per 0.001 degree of latitude.
const line = (latFrom: number, latTo: number) => [{ latitude: latFrom, longitude: 145 }, { latitude: latTo, longitude: 145 }];
const walk = (coords: RouteSegment['coords'], times: Partial<RouteSegment> = {}) =>
    ({ type: 'walk', coords, ...times }) as RouteSegment;
const ride = () => ({ type: 'transit', coords: [] }) as unknown as RouteSegment;
const journey = (segments: RouteSegment[], legs: number) =>
    ({ segments, legs: Array.from({ length: legs }, () => ({})) }) as unknown as GtfsJourney;

test('a walk before and after a ride is timed from its length at the walking speed', () => {
    const slots = walkSecondsByGap(journey([walk(line(0, 0.001)), ride(), walk(line(0, 0.002))], 1), 1.11);
    assert.equal(Math.round(slots[0]!), 100);
    assert.equal(Math.round(slots[1]!), 200);
});

test('a walk with its own times uses them', () => {
    const slots = walkSecondsByGap(journey([ride(), walk(line(0, 0.01), { departureTime: '10:00:00', arrivalTime: '10:03:00' })], 1), 1.4);
    assert.deepEqual(slots, [null, 180]);
});

test('a gap with no walk is null', () => {
    assert.deepEqual(walkSecondsByGap(journey([ride(), ride()], 2), 1.4), [null, null, null]);
});

test('segments that do not match the legs give no walk times', () => {
    assert.deepEqual(walkSecondsByGap(journey([walk(line(0, 0.001))], 1), 1.4), [null, null]);
});
