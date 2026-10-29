import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAlightAlert } from '@/services/trips/alightAlert';
import type { RideStep, TripStep } from '@/services/trips/tripSteps';

// 0.001 degrees of latitude is about 111 m, so 0.0005 is inside the 100 m radius and 0.002 is well outside it.
const at = (lat: number) => ({ latitude: lat, longitude: 144.9 });
const stop = (lat: number) => ({ stopName: 's', latitude: lat, longitude: 144.9 });

const ride = (lats: number[]): RideStep => ({
    type: 'transit', from: 'A', to: 'Z', end: at(lats[lats.length - 1]),
    routeName: '96', routeType: 0, line: '', stops: lats.map(stop),
} as unknown as RideStep);

const walk: TripStep = { type: 'walk', from: 'A', to: 'B', end: at(0) };

test('alerts once when the rider reaches the stop before the last', () => {
    const alerts: RideStep[] = [];
    const steps = [ride([-37.80, -37.82, -37.84])];
    const check = createAlightAlert(steps, r => alerts.push(r));

    check(0, at(-37.81)); // between stops
    assert.equal(alerts.length, 0);
    check(0, at(-37.8205)); // within 100 m of the stop before the last
    check(0, at(-37.8205));
    assert.equal(alerts.length, 1);
});

test('a one-stop ride does not alert while still at the boarding stop', () => {
    const alerts: RideStep[] = [];
    const check = createAlightAlert([ride([-37.80, -37.84])], r => alerts.push(r));
    check(0, { ...at(-37.8002), speed: 20 }, 0); // 4 km out at 20 m/s is far over a minute, and this is the boarding stop anyway
    assert.equal(alerts.length, 0);
});

test('a one-stop ride alerts when distance over speed drops to a minute', () => {
    const alerts: RideStep[] = [];
    const check = createAlightAlert([ride([-37.80, -37.84])], r => alerts.push(r));
    check(0, { ...at(-37.82), speed: 10 }, 0);   // about 2.2 km left at 10 m/s
    assert.equal(alerts.length, 0);
    check(0, { ...at(-37.8365), speed: 10 }, 0); // about 400 m left at 10 m/s, 40 s
    check(0, { ...at(-37.8375), speed: 10 }, 0);
    assert.equal(alerts.length, 1);
});

test('a one-stop ride uses the arrival time when the vehicle is not moving', () => {
    const alerts: RideStep[] = [];
    const due = { ...ride([-37.80, -37.84]), arrivalMs: 1_000_000 };
    const check = createAlightAlert([due], r => alerts.push(r));
    check(0, { ...at(-37.82), speed: 0 }, 900_000);  // 100 s to go
    assert.equal(alerts.length, 0);
    check(0, { ...at(-37.82), speed: null }, 945_000); // 55 s to go
    assert.equal(alerts.length, 1);
});

test('a one-stop ride with no speed or arrival time alerts only within 100 m of the stop', () => {
    const alerts: RideStep[] = [];
    const check = createAlightAlert([ride([-37.80, -37.84])], r => alerts.push(r));
    check(0, at(-37.82));
    assert.equal(alerts.length, 0);
    check(0, at(-37.8395));
    assert.equal(alerts.length, 1);
});

test('ignores walks, unknown steps and rides with fewer than two stops', () => {
    const alerts: RideStep[] = [];
    const check = createAlightAlert([walk, ride([-37.8])], r => alerts.push(r));
    check(0, at(0));
    check(1, at(-37.8));
    check(5, at(0));
    assert.equal(alerts.length, 0);
});

test('each ride alerts on its own', () => {
    const alerts: RideStep[] = [];
    const steps = [ride([-37.80, -37.82, -37.84]), walk, ride([-37.90, -37.92, -37.94])];
    const check = createAlightAlert(steps, r => alerts.push(r));
    check(0, at(-37.8205));
    check(2, at(-37.9205));
    assert.equal(alerts.length, 2);
});
