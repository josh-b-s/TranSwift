import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leaveSeconds, retimeJourney } from '@/services/gtfs/router/journeyTimes';
import type { GtfsJourney, RouteSegment } from '@/services/gtfs/router/routeTypes';

test('leaving is the first boarding less the walk to the stop', () => {
    assert.equal(leaveSeconds(8 * 3600, 8 * 3600 + 20 * 60, 300), 8 * 3600 + 15 * 60);
});

test('a slower walk means leaving earlier', () => {
    const board = 9 * 3600;
    assert.ok(leaveSeconds(board - 1800, board, 600) < leaveSeconds(board - 1800, board, 300));
});

test('with no walk the rider leaves at the boarding time', () => {
    assert.equal(leaveSeconds(8 * 3600, 8 * 3600 + 600, null), 8 * 3600 + 600);
});

test('with no ride the search start stands', () => {
    assert.equal(leaveSeconds(8 * 3600, undefined, null), 8 * 3600);
});

// 0.001 degrees of latitude is about 111 m.
const at = (lat: number) => ({ latitude: lat, longitude: 144 });
const walk = (from: number, to: number): RouteSegment => ({ type: 'walk', coords: [at(from), at(to)] } as RouteSegment);
const ride = { type: 'transit', coords: [at(1), at(2)] } as RouteSegment;
const journey = (segments: RouteSegment[]): GtfsJourney =>
    ({ segments, legs: [{ departureTime: '08:30:00', arrivalTime: '08:50:00' }] } as GtfsJourney);

test('a routed walk that is longer moves the leave and arrive times out', () => {
    const straight = retimeJourney(journey([walk(0.9998, 1), ride, walk(2, 2.0002)]), 1.4)!;
    const routed = retimeJourney(journey([walk(0.998, 1), ride, walk(2, 2.002)]), 1.4)!;
    assert.ok(routed.departureTime < straight.departureTime);
    assert.ok(routed.arrivalTime > straight.arrivalTime);
    assert.ok(routed.totalDurationMin > straight.totalDurationMin);
});

test('leave is the first boarding less the walk, arrive the last alighting plus the walk', () => {
    const timed = (departureTime: string, arrivalTime: string, from: number, to: number) => ({ ...walk(from, to), departureTime, arrivalTime }) as RouteSegment;
    // Ten minutes of walking before the ride and two after, as the walks report them.
    const times = retimeJourney(journey([timed('08:00:00', '08:10:00', 0, 1), ride, timed('08:50:00', '08:52:00', 2, 3)]), 1.4)!;
    assert.equal(times.departureTime, '08:20:00');
    assert.equal(times.arrivalTime, '08:52:00');
    assert.equal(times.totalDurationMin, 32);
});

test('a journey with no ride has nothing to retime', () => {
    assert.equal(retimeJourney({ segments: [walk(0, 1)], legs: [] } as unknown as GtfsJourney, 1.4), null);
});
