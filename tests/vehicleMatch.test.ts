import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchRecentPath, type PathFix } from '@/services/trips/vehicleMatch';
import type { TripPath } from '@/services/gtfs/vehicles/tripPath';

const M_PER_DEG_LAT = 111_320;
const cosLat = Math.cos((37.8 * Math.PI) / 180);
// Metres east and north of a fixed origin in Melbourne.
const at = (eastM: number, northM: number) => ({
    latitude: -37.8 + northM / M_PER_DEG_LAT,
    longitude: 144.9 + eastM / (M_PER_DEG_LAT * cosLat),
});
const trip = (tripId: string, points: [number, number][], stopsAtM: [number, number][]): TripPath => ({
    tripId,
    line: points.map(([e, n]) => at(e, n)),
    stops: stopsAtM.map(([e, n]) => at(e, n)),
    terminus: null,
    shaped: true,
});
// Rides along y = 0 eastwards, 1 km, with stops every 250 m.
const eastRoute = trip('east', [[0, 0], [1000, 0]], [[0, 0], [250, 0], [500, 0], [750, 0], [1000, 0]]);
const northRoute = trip('north', [[0, -500], [0, 500]], [[0, -500], [0, 0], [0, 500]]);

/** One fix per 5 s starting at `fromM` along x, moving `mps`, with `offNorthM` of sideways drift. */
const ride = (fromM: number, mps: number, count: number, offNorthM = 0): PathFix[] =>
    Array.from({ length: count }, (_, i) => ({ ...at(fromM + mps * 5 * i, offNorthM), time: i * 5000 }));

test('matches a rider who started tracking mid-ride', () => {
    const match = matchRecentPath(ride(300, 8, 8), [northRoute, eastRoute]);
    assert.equal(match?.tripId, 'east');
    assert.equal(match?.stopsPassed, 2);
});

test('tolerates GPS drift beside the line', () => {
    assert.equal(matchRecentPath(ride(100, 8, 8, 20), [eastRoute])?.tripId, 'east');
});

test('turns down a path riding the opposite way', () => {
    assert.equal(matchRecentPath(ride(900, -8, 8), [eastRoute]), null);
});

test('turns down someone walking along the route', () => {
    assert.equal(matchRecentPath(ride(100, 1.4, 12), [eastRoute]), null);
});

test('turns down a path on a parallel street', () => {
    assert.equal(matchRecentPath(ride(100, 8, 8, 80), [eastRoute]), null);
});

test('turns down someone standing at a stop', () => {
    assert.equal(matchRecentPath(ride(250, 0, 8), [eastRoute]), null);
});

test('needs enough fixes', () => {
    assert.equal(matchRecentPath(ride(100, 8, 3), [eastRoute]), null);
});

test('prefers the trip that went by more stops when lines overlap', () => {
    const express = trip('express', [[0, 0], [1000, 0]], [[0, 0], [1000, 0]]);
    assert.equal(matchRecentPath(ride(100, 8, 8), [express, eastRoute])?.tripId, 'east');
});

test('follows a line that doubles back', () => {
    // Out 500 m east, round a corner, then back along a street 30 m north; the rider is on the way back.
    const loop = trip('loop', [[0, 0], [500, 0], [500, 30], [0, 30]], [[0, 0], [500, 0], [0, 30]]);
    assert.equal(matchRecentPath(ride(450, -8, 8, 30), [loop])?.tripId, 'loop');
});

// A road that bows 60 m north between two stops 1 km apart, ridden at 8 m/s with a fix every 5 s.
const bowed = (fromM: number): PathFix[] => Array.from({ length: 8 }, (_, i) => {
    const x = fromM + 40 * i;
    return { ...at(x, 60 * Math.sin((Math.PI * x) / 1000)), time: i * 5000 };
});
const chord = (shaped: boolean) => ({ ...trip('bow', [[0, 0], [1000, 0]], [[0, 0], [1000, 0]]), shaped });

test('without a shape, follows a curving road that leaves the straight line between stops', () => {
    assert.equal(matchRecentPath(bowed(300), [chord(false)])?.tripId, 'bow');
});

test('with a shape, the same bow is off the line', () => {
    assert.equal(matchRecentPath(bowed(300), [chord(true)]), null);
});

test('without a shape, still turns down a path on a parallel street', () => {
    assert.equal(matchRecentPath(ride(100, 8, 8, 150), [chord(false)]), null);
});

test('returns null with no candidates', () => {
    assert.equal(matchRecentPath(ride(100, 8, 8), []), null);
});
