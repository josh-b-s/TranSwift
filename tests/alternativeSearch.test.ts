import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alternativeStart, routeToAvoid, usesRoute } from '@/services/trips/alternativeSearch';
import type { TripStep } from '@/services/trips/tripSteps';
import type { GtfsJourney } from '@/services/gtfs/router/routeTypes';

// 0.001 degrees of latitude is about 111 m.
const at = (lat: number) => ({ latitude: lat, longitude: 144.9 });
const stop = (name: string, lat: number) => ({ name, ...at(lat) });
const now = new Date(2026, 10, 1, 13, 0, 0);

const stops = [stop('A', -37.80), stop('B', -37.81), stop('C', -37.82), stop('D', -37.83)];
const steps = [
    { type: 'walk', from: 'Start', to: 'A', end: at(-37.80) },
    { type: 'transit', from: 'A', to: 'D', end: at(-37.83), routeName: '96', routeType: 0, line: '', stops },
    { type: 'walk', from: 'D', to: 'Home', end: at(-37.84) },
] as unknown as TripStep[];

test('walking, the search starts where the rider stands, now', () => {
    const start = alternativeStart(steps, 0, null, at(-37.799), null, now);
    assert.deepEqual(start.origin, at(-37.799));
    assert.equal(start.label, 'your location');
    assert.equal(start.via, null);
    assert.equal(start.departAt.getTime(), now.getTime());
});

test('waiting to board, the search starts where the rider stands', () => {
    const start = alternativeStart(steps, 1, null, at(-37.80), null, now);
    assert.equal(start.via, null);
});

test('on a vehicle, the search starts at the next stop', () => {
    // Three stops left of a four-stop ride means the next stop is the second one.
    const start = alternativeStart(steps, 1, 3, at(-37.8005), 10, now);
    assert.deepEqual(start.origin, at(-37.81));
    assert.equal(start.label, 'B');
    assert.equal(start.via?.name, 'B');
});

test('on a vehicle, the search is timed for when the next stop is reached', () => {
    // About 1.1 km to the next stop at 10 m/s is a little over 100 seconds.
    const start = alternativeStart(steps, 1, 3, at(-37.80), 10, now);
    const waitS = (start.departAt.getTime() - now.getTime()) / 1000;
    assert.ok(waitS > 100 && waitS < 125, `waited ${waitS}`);
});

test('without a speed, the wait falls back to two minutes', () => {
    const start = alternativeStart(steps, 1, 3, at(-37.80), null, now);
    assert.equal((start.departAt.getTime() - now.getTime()) / 1000, 120);
});

test('the wait is never shorter than half a minute', () => {
    const start = alternativeStart(steps, 1, 3, at(-37.8099), 20, now);
    assert.equal((start.departAt.getTime() - now.getTime()) / 1000, 30);
});

test('the route to avoid is the ride the rider is on or about to take', () => {
    assert.deepEqual(routeToAvoid(steps, 0), { name: '96', type: 0 });
    assert.deepEqual(routeToAvoid(steps, 1), { name: '96', type: 0 });
});

test('there is no route to avoid once the last ride is behind the rider', () => {
    assert.equal(routeToAvoid(steps, 2), null);
});

test('a journey uses a route when any of its legs is on it', () => {
    const journey = { legs: [{ routeName: '11', routeType: 0 }, { routeName: '96', routeType: 0 }] } as unknown as GtfsJourney;
    assert.equal(usesRoute(journey, { name: '96', type: 0 }), true);
    assert.equal(usesRoute(journey, { name: '96', type: 2 }), false);
    assert.equal(usesRoute(journey, { name: '86', type: 0 }), false);
});
