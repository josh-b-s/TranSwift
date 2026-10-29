import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyLiveStatus, applyLiveToStops, hasLiveData, type StopRealtime } from '@/services/gtfs/departures/liveDepartures';
import { formatDelay } from '@/services/gtfs/departures/departureFormat';
import type { Departure } from '@/services/gtfs/departures/stopDepartures';

const MIN = 60_000;
const NOW = 1_000 * MIN;

const dep = (tripPk: number, minutesFromNow: number): Departure => ({
    timeMs: NOW + minutesFromNow * MIN, routeName: String(tripPk), routeType: 0, terminus: 'X', routeColor: '#000000', routeTextColor: '#FFFFFF',
    tripPk, stopSequence: 1, dayStartMs: 0,
});

const status = (tripPk: number, over: Partial<StopRealtime>): StopRealtime => ({
    tripPk, stopSequence: 1, cancelled: false, skipped: false, delaySec: null, arrivalDelaySec: null, ...over,
});

test('with no realtime the list is the scheduled one, nothing gone, nothing live', () => {
    const out = applyLiveStatus([dep(1, 2), dep(2, 5)], [], NOW);
    assert.deepEqual(out.map(d => d.liveTimeMs), [NOW + 2 * MIN, NOW + 5 * MIN]);
    assert.equal(hasLiveData(out), false);
});

test('a delay moves the live time and reorders the list', () => {
    const out = applyLiveStatus([dep(1, 2), dep(2, 5)], [status(1, { delaySec: 420 })], NOW);
    assert.deepEqual(out.map(d => d.tripPk), [2, 1]);
    assert.equal(out[1].liveTimeMs, NOW + 9 * MIN);
    assert.equal(out[1].timeMs, NOW + 2 * MIN);
    assert.equal(hasLiveData(out), true);
});

test('a late trip scheduled in the past stays, an on-time one that has gone does not', () => {
    const out = applyLiveStatus([dep(1, -4), dep(2, -4)], [status(1, { delaySec: 360 })], NOW);
    assert.deepEqual(out.map(d => d.tripPk), [1]);
    assert.equal(out[0].liveTimeMs, NOW + 2 * MIN);
});

test('an early trip that has already left is dropped', () => {
    assert.deepEqual(applyLiveStatus([dep(1, 1)], [status(1, { delaySec: -180 })], NOW), []);
});

test('a cancelled trip is flagged and kept only while its scheduled time is ahead', () => {
    const out = applyLiveStatus([dep(1, 3), dep(2, -2)], [status(1, { cancelled: true }), status(2, { cancelled: true })], NOW);
    assert.deepEqual(out.map(d => [d.tripPk, d.cancelled]), [[1, true]]);
    assert.equal(hasLiveData(out), true);
});

test('status is matched on the trip and the stop together', () => {
    const out = applyLiveStatus([dep(1, 2)], [{ ...status(1, { delaySec: 600 }), stopSequence: 7 }], NOW);
    assert.equal(out[0].delaySec, null);
});

test('a skipped stop is flagged and an on-time report is live data', () => {
    const out = applyLiveStatus([dep(1, 2), dep(2, 3)], [status(1, { skipped: true }), status(2, { delaySec: 0 })], NOW);
    assert.deepEqual(out.map(d => d.skipped), [true, false]);
    assert.equal(out[1].delaySec, 0);
    assert.equal(hasLiveData(out), true);
});

test('delay wording rounds to the minute and treats under 30 s as on time', () => {
    assert.equal(formatDelay(0), 'On time');
    assert.equal(formatDelay(29), 'On time');
    assert.equal(formatDelay(-20), 'On time');
    assert.equal(formatDelay(90), '2 min late');
    assert.equal(formatDelay(240), '4 min late');
    assert.equal(formatDelay(-150), '3 min early');
});

test('trip stops take the delay in force at each stop and flag skipped ones', () => {
    const stops = [1, 2, 3].map(stopSequence => ({ stopName: `S${stopSequence}`, stopSequence, timeMs: NOW + stopSequence * MIN }));
    const statuses = [
        { tripPk: 5, stopSequence: 1, cancelled: false, skipped: false, delaySec: null, arrivalDelaySec: null },
        { tripPk: 5, stopSequence: 2, cancelled: false, skipped: true, delaySec: 120, arrivalDelaySec: 120 },
        { tripPk: 5, stopSequence: 3, cancelled: false, skipped: false, delaySec: 120, arrivalDelaySec: 120 },
        { tripPk: 6, stopSequence: 1, cancelled: false, skipped: false, delaySec: 999, arrivalDelaySec: 999 },
    ];
    const out = applyLiveToStops(stops, 5, statuses);
    assert.deepEqual(out.map(s => s.liveTimeMs), [NOW + MIN, NOW + 4 * MIN, NOW + 5 * MIN]);
    assert.deepEqual(out.map(s => s.skipped), [false, true, false]);
    assert.equal(out[0].delaySec, null);
});

test('trip stops use the departure delay at the first stop and the arrival delay at the rest', () => {
    const stops = [1, 2, 3].map(stopSequence => ({ stopName: `S${stopSequence}`, stopSequence, timeMs: NOW + stopSequence * MIN }));
    const status = (stopSequence: number, delaySec: number, arrivalDelaySec: number) =>
        ({ tripPk: 5, stopSequence, cancelled: false, skipped: false, delaySec, arrivalDelaySec });
    const out = applyLiveToStops(stops, 5, [status(1, 120, 30), status(2, 120, 60), status(3, 120, -60)]);
    assert.deepEqual(out.map(s => s.liveTimeMs), [NOW + MIN + 120_000, NOW + 2 * MIN + 60_000, NOW + 3 * MIN - 60_000]);
});
