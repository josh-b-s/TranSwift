import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepsFromJourney, type RideStep } from '@/services/trips/tripSteps';
import type { GtfsJourney } from '@/services/gtfs/router/routeTypes';

const point = { latitude: -37.8, longitude: 144.9 };

function journeyArriving(arrivalTime: string): GtfsJourney {
    return {
        segments: [{
            coords: [point], routeName: '96', routeType: 0, originStopName: 'A', destStopName: 'B',
            type: 'transit', arrivalTime, stops: [],
        }],
    } as unknown as GtfsJourney;
}

const arrivalOf = (arrival: string, now: Date) => (stepsFromJourney(journeyArriving(arrival), now)[0] as RideStep).arrivalMs;

test('turns the arrival time of day into a time today', () => {
    const now = new Date(2026, 9, 29, 15, 30, 0);
    assert.equal(arrivalOf('15:41:30', now), new Date(2026, 9, 29, 15, 41, 30).getTime());
});

test('a ride crossing midnight arrives tomorrow', () => {
    const now = new Date(2026, 9, 29, 23, 50, 0);
    assert.equal(arrivalOf('00:05:00', now), new Date(2026, 9, 30, 0, 5, 0).getTime());
});

test('leaves the arrival out when the segment has none', () => {
    const journey = journeyArriving('00:00:00');
    delete (journey.segments[0] as { arrivalTime?: string }).arrivalTime;
    assert.equal((stepsFromJourney(journey)[0] as RideStep).arrivalMs, undefined);
});
