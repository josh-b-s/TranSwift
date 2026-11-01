import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTripSession } from '@/services/trips/tripSession';
import type { RideStep, TripStep } from '@/services/trips/tripSteps';

// 0.001 degrees of latitude is about 111 m.
const at = (lat: number) => ({ latitude: lat, longitude: 144.9 });
const stop = (name: string, lat: number) => ({ name, ...at(lat) });
const fix = (lat: number, time: number, speed: number) => ({ ...at(lat), time, accuracy: 5, speed });
const S = 1000;

const A = -37.80, B = -37.82, C = -37.84, D = -37.86;
// The next boarding stop, about 250 m on from B, where the rider could walk to after getting off early.
const E = -37.8225, F = -37.90, DEST = -37.91;
const steps = [
    { type: 'walk', from: 'Start', to: 'Stop A', end: at(A) },
    {
        type: 'transit', from: 'Stop A', to: 'Stop D', end: at(D), routeName: '96', routeType: 0, line: '',
        stops: [stop('Stop A', A), stop('Stop B', B), stop('Stop C', C), stop('Stop D', D)],
    } as unknown as RideStep,
    { type: 'walk', from: 'Stop D', to: 'Stop E', end: at(E) },
    {
        type: 'transit', from: 'Stop E', to: 'Stop F', end: at(F), routeName: '11', routeType: 0, line: '',
        stops: [stop('Stop E', E), stop('Stop F', F)],
    } as unknown as RideStep,
    { type: 'walk', from: 'Stop F', to: 'Home', end: at(DEST) },
] as TripStep[];

/** Boarded at A, and carried to B at vehicle speed by t = 40 s. */
function riddenToB() {
    const session = createTripSession(steps);
    session.addFix(fix(A - 0.0005, 0, 1.4));
    session.addFix(fix(A, 5 * S, 1.4));
    session.addFix(fix(A - 0.003, 15 * S, 9));
    session.addFix(fix(B, 40 * S, 9));
    assert.equal(session.stepIndex, 1);
    assert.equal(session.stopsLeft, 2);
    return session;
}

/** Walks from B towards E at walking pace, one fix every 10 seconds from t = 50 s. */
function walkOff(session: ReturnType<typeof createTripSession>, lats: number[]) {
    lats.forEach((lat, i) => session.addFix(fix(lat, (50 + i * 10) * S, 1.3)));
}

test('getting off early and walking to the next boarding stop skips to the step after it', () => {
    const session = riddenToB();
    walkOff(session, [B - 0.0005, B - 0.001, B - 0.0015, B - 0.002, E + 0.0001, E]);
    assert.equal(session.stepIndex, 3);
    assert.equal(session.done, false);
});

test('the part ridden is kept as a ride to the last stop reached', () => {
    const session = riddenToB();
    walkOff(session, [B - 0.0005, B - 0.001, B - 0.0015, B - 0.002, E + 0.0001, E]);
    const ride = session.legs.find(leg => leg.kind === 'ride');
    assert.ok(ride && ride.kind === 'ride');
    assert.equal(ride.from, 'Stop A');
    assert.equal(ride.to, 'Stop B');
});

test('the walk to the next stop is recorded as a walk with no per-stop best', () => {
    const session = riddenToB();
    walkOff(session, [B - 0.0005, B - 0.001, B - 0.0015, B - 0.002, E + 0.0001, E]);
    const walk = session.legs.find(leg => leg.kind === 'walk' && leg.from === 'Stop B');
    assert.ok(walk && walk.kind === 'walk');
    assert.equal(walk.to, 'Stop E');
    assert.equal(walk.bestKey, undefined);
});

test('one fix at the later stop is not enough to skip', () => {
    const session = riddenToB();
    walkOff(session, [B - 0.0005, B - 0.001, B - 0.0015, B - 0.002, E]);
    assert.equal(session.stepIndex, 1);
});

test('passing the later stop at vehicle speed does not skip', () => {
    const session = riddenToB();
    session.addFix(fix(E + 0.0002, 50 * S, 9));
    session.addFix(fix(E, 52 * S, 9));
    session.addFix(fix(E - 0.0002, 54 * S, 9));
    assert.equal(session.stepIndex, 1);
});

test('a walk step never skips ahead', () => {
    const session = createTripSession(steps);
    session.addFix(fix(E + 0.0001, 0, 1.3));
    session.addFix(fix(E, 10 * S, 1.3));
    assert.equal(session.stepIndex, 0);
});

test('vehicle speed held on a walk step is not counted as walking', () => {
    const session = createTripSession(steps);
    // About 60 m on foot, then a vehicle at 8 m/s for 15 seconds, which is about 120 m.
    let lat = A - 0.01;
    session.addFix(fix(lat, 0, 1.4));
    for (let i = 1; i <= 5; i++) session.addFix(fix((lat -= 0.000126), i * 10 * S, 1.4));
    for (let i = 1; i <= 6; i++) session.addFix(fix((lat -= 0.00022), 50 * S + i * 3 * S, 8));
    const walked = session.walkProgress;
    assert.ok(walked);
    assert.ok(walked.distanceM < 90, `counted ${walked.distanceM} m`);
});

test('a short burst of speed on a walk step still counts', () => {
    const session = createTripSession(steps);
    let lat = A - 0.01;
    session.addFix(fix(lat, 0, 1.4));
    for (let i = 1; i <= 3; i++) session.addFix(fix((lat -= 0.0006), i * 3 * S, 5.5));
    session.addFix(fix((lat -= 0.000126), 15 * S, 1.4));
    const walked = session.walkProgress;
    assert.ok(walked);
    assert.ok(walked.distanceM > 200, `counted ${walked.distanceM} m`);
});

test('creeping away from a stop on a vehicle at walking pace is read as getting off', () => {
    const session = riddenToB();
    assert.equal(session.leftVehicle, null);
    walkOff(session, [B - 0.0004, B - 0.0008, B - 0.0012, B - 0.0016]);
    assert.deepEqual(session.leftVehicle, { stopName: 'Stop B' });
});

test('a vehicle waiting at a stop is not read as getting off', () => {
    const session = riddenToB();
    for (let i = 0; i < 12; i++) session.addFix(fix(B, (50 + i * 10) * S, 0));
    assert.equal(session.leftVehicle, null);
});

test('a ride cut short saves what was ridden and the walk away from it', () => {
    const session = riddenToB();
    walkOff(session, [B - 0.0004, B - 0.0008, B - 0.0012, B - 0.0016]);
    const [ride, walk] = session.inProgress;
    assert.equal(ride.kind, 'ride');
    assert.equal(walk.kind, 'walk');
    assert.equal(walk.incomplete, true);
});
