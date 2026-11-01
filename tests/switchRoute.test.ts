import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rideBetween } from '@/services/trips/switchRoute';
import { decodeLine } from '@/services/trips/lineCodec';
import type { RideStep } from '@/services/trips/tripSteps';

const stop = (name: string, lat: number) => ({ name, latitude: lat, longitude: 144.9 });
const ride = {
    type: 'transit', from: 'A', to: 'D', end: { latitude: -37.83, longitude: 144.9 },
    routeName: '96', routeType: 0, routeColor: 'E10', line: 'whole-line',
    stops: [stop('A', -37.80), stop('B', -37.81), stop('C', -37.82), stop('D', -37.83)],
    arrivalMs: 123, tripPk: 7, alightSequence: 9,
} as RideStep;

test('a part of a ride runs between its two stops, with the stops in between', () => {
    const part = rideBetween(ride, 1, 3);
    assert.equal(part.from, 'B');
    assert.equal(part.to, 'D');
    assert.deepEqual(part.stops.map(s => s.name), ['B', 'C', 'D']);
    assert.deepEqual(part.end, { latitude: -37.83, longitude: 144.9 });
});

test('a part of a ride draws its line through its stops', () => {
    const part = rideBetween(ride, 0, 2);
    const line = decodeLine(part.line);
    assert.equal(line.length, 3);
    assert.ok(Math.abs(line[2].latitude - -37.82) < 1e-4);
});

test('a part of a ride keeps the route but drops the live arrival of the whole ride', () => {
    const part = rideBetween(ride, 0, 1);
    assert.equal(part.routeName, '96');
    assert.equal(part.routeColor, 'E10');
    assert.equal(part.arrivalMs, undefined);
    assert.equal(part.tripPk, undefined);
    assert.equal(part.alightSequence, undefined);
});

test('the original ride is left as it was', () => {
    rideBetween(ride, 1, 2);
    assert.equal(ride.stops.length, 4);
    assert.equal(ride.line, 'whole-line');
});
