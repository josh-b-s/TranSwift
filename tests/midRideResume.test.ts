import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromMatch, rideStepTrips } from '@/services/trips/midRideResume';
import type { TripStep } from '@/services/trips/tripSteps';
import type { TripMatch } from '@/services/trips/vehicleMatch';

const M_PER_DEG_LAT = 111_320;
const north = (m: number) => ({ latitude: -37.8 + m / M_PER_DEG_LAT, longitude: 144.9 });
const stopAt = (m: number) => ({ name: `s${m}`, ...north(m) });
const path = { tripId: 'T1', line: [north(0), north(2000)], stops: [], terminus: null };
const ride = { type: 'transit', from: 's0', to: 's2000', end: north(2000), routeName: '96', routeType: 0, line: '', tripPk: 7,
    stops: [stopAt(0), stopAt(500), stopAt(1000), stopAt(1500), stopAt(2000)] } as unknown as TripStep;
const walk = { type: 'walk', from: 'Home', to: 's0', end: north(0) } as TripStep;
const steps = [walk, ride];
const match = (lastAlongM: number): TripMatch => ({ tripId: 'T1', onLineShare: 1, alongM: 300, stopsPassed: 1, lastAlongM });

test('lists only the ride steps that name a trip', () => {
    assert.deepEqual(rideStepTrips(steps), [{ stepIndex: 1, tripPk: 7 }]);
});

test('carries on from the ride, past the stops already gone by', () => {
    const resume = resumeFromMatch(steps, [{ stepIndex: 1, path }], match(1020));
    assert.equal(resume?.reachedStop, 2);
    assert.equal(resume?.steps.length, 1);
    assert.equal(resume?.steps[0], ride);
});

test('a rider before the boarding stop has reached none', () => {
    assert.equal(resumeFromMatch(steps, [{ stepIndex: 1, path }], match(-200 + 0))?.reachedStop, 0);
});

test('gives nothing when the rider is already at the last stop', () => {
    assert.equal(resumeFromMatch(steps, [{ stepIndex: 1, path }], match(1990)), null);
});

test('gives nothing for a trip that is not a candidate', () => {
    assert.equal(resumeFromMatch(steps, [], match(500)), null);
});
