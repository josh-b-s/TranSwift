import { test } from 'node:test';
import assert from 'node:assert/strict';
import { journeyBar } from '@/services/gtfs/router/journeyBar';
import type { GtfsJourney } from '@/services/gtfs/router/routeTypes';

const leg = (departureTime?: string, arrivalTime?: string) => ({
    routeName: '96', routeType: 0, originStopName: 'A', destStopName: 'B', departureTime, arrivalTime,
});

const journey = (legs: GtfsJourney['legs'], departureTime = '10:00:00', arrivalTime = '10:30:00') =>
    ({ legs, departureTime, arrivalTime }) as GtfsJourney;

test('rides are weighted by time and the walks or waits around them become gaps', () => {
    const pieces = journeyBar(journey([leg('10:05:00', '10:20:00')]));
    assert.deepEqual(pieces.map(p => [p.kind, p.weight]), [['gap', 300], ['ride', 900], ['gap', 600]]);
});

test('back-to-back rides leave no gap between them', () => {
    const pieces = journeyBar(journey([leg('10:00:00', '10:10:00'), leg('10:10:00', '10:30:00')]));
    assert.deepEqual(pieces.map(p => p.kind), ['ride', 'ride']);
});

test('hours past 24 count as the same service day', () => {
    const pieces = journeyBar(journey([leg('24:10:00', '24:20:00')], '24:00:00', '24:30:00'));
    assert.deepEqual(pieces.map(p => [p.kind, p.weight]), [['gap', 600], ['ride', 600], ['gap', 600]]);
});

test('a leg without times makes the rides share the bar equally', () => {
    const pieces = journeyBar(journey([leg('10:05:00', '10:20:00'), leg()]));
    assert.deepEqual(pieces.map(p => [p.kind, p.weight]), [['ride', 1], ['ride', 1]]);
});

test('walking time is attached to the gap it belongs to', () => {
    const pieces = journeyBar(journey([leg('10:05:00', '10:20:00')]), [240, 90]);
    assert.deepEqual(pieces.map(p => (p.kind === 'gap' ? p.walkSeconds : 'ride')), [240, 'ride', 90]);
});
