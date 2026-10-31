import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTripSession } from '@/services/trips/tripSession';
import type { RideStep, TripStep } from '@/services/trips/tripSteps';

// 0.001 degrees of latitude is about 111 m.
const at = (lat: number) => ({ latitude: lat, longitude: 144.9 });
const fix = (lat: number, time: number, speed: number | null = 1) => ({ ...at(lat), time, accuracy: 5, speed });
const stop = (lat: number) => ({ name: 's', ...at(lat) });

const board = -37.80;
const alight = -37.84; // about 4.4 km on
const steps: TripStep[] = [
    { type: 'walk', from: 'Start', to: 'A', end: at(board) },
    {
        type: 'transit', from: 'A', to: 'B', end: at(alight), routeName: '96', routeType: 0, line: '',
        stops: [stop(board), stop(-37.82), stop(alight)],
    } as unknown as RideStep,
];

function atBoardingStop() {
    const session = createTripSession(steps);
    session.addFix(fix(-37.7995, 0));
    session.addFix(fix(board, 1000));
    assert.equal(session.stepIndex, 1);
    return session;
}

test('arriving at the boarding stop starts the ride step without boarding it', () => {
    const session = atBoardingStop();
    assert.equal(session.boarded, false);
});

test('waiting at the stop does not board', () => {
    const session = atBoardingStop();
    session.addFix(fix(board, 2000, 0));
    session.addFix(fix(-37.8002, 3000, 0.3));
    assert.equal(session.boarded, false);
});

test('moving at vehicle speed boards', () => {
    const session = atBoardingStop();
    session.addFix(fix(-37.801, 2000, 8));
    assert.equal(session.boarded, true);
});

test('getting far from the stop boards when no speed is reported', () => {
    const session = atBoardingStop();
    session.addFix(fix(-37.81, 2000, null));
    assert.equal(session.boarded, true);
});

test('the ride ends at its last stop once boarded', () => {
    const session = atBoardingStop();
    session.addFix(fix(-37.82, 2000, 9));
    session.addFix(fix(alight, 3000, 2));
    assert.equal(session.done, true);
});

test('a ride with no stops listed counts as boarded', () => {
    const ride = { ...steps[1], stops: [] } as unknown as TripStep;
    const session = createTripSession([ride]);
    session.addFix(fix(board, 0, 0));
    assert.equal(session.boarded, true);
});

test('a walk in progress can be read back, marked incomplete', () => {
    const session = createTripSession(steps);
    assert.equal(session.unfinishedWalk, null);
    session.addFix(fix(-37.7990, 0));
    session.addFix(fix(-37.7995, 1000));
    const leg = session.unfinishedWalk;
    assert.ok(leg);
    assert.equal(leg.incomplete, true);
    assert.equal(leg.to, 'A');
    assert.equal(leg.bestKey, undefined);
});

test('there is no walk in progress during a ride', () => {
    const session = atBoardingStop();
    assert.equal(session.unfinishedWalk, null);
});
