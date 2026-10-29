import { test } from 'node:test';
import assert from 'node:assert/strict';
import { journeyKey, matchTrips } from '@/services/trips/matchedTrips';
import type { HistoryTrip } from '@/services/trips/tripHistory';
import type { SavedLeg } from '@/services/trips/tripStore';

const leg = (from: string, to: string): SavedLeg => ({ kind: 'ride', stepIndex: 0, from, to, routeName: '1', routeType: 3, line: '' });

const trip = (startedAt: number, from: string, to: string, distanceM: number, durationS: number): HistoryTrip => ({
    startedAt, records: [], legs: [leg(from, 'Mid'), leg('Mid', to)], totals: { distanceM, durationS, topSpeedMps: 0 },
});

test('the key is the first stop and the last stop', () => {
    assert.equal(journeyKey(trip(1, 'Home', 'Uni', 0, 0)), 'Home>Uni');
    assert.equal(journeyKey({ legs: [] }), null);
});

test('matches only trips between the same places and names the fastest walker', () => {
    const history = [
        trip(4, 'Home', 'Uni', 600, 400),
        trip(3, 'Home', 'Work', 600, 300),
        trip(2, 'Home', 'Uni', 600, 300),
        trip(1, 'Home', 'Uni', 0, 0),
    ];
    const { runs, fastestStartedAt } = matchTrips(history, history[0]);
    assert.deepEqual(runs.map(r => r.trip.startedAt), [4, 2, 1]);
    assert.equal(fastestStartedAt, 2);
});

const timed = (t: HistoryTrip, totalS: number): HistoryTrip => ({ ...t, endedAt: t.startedAt + totalS * 1000 });

test('total time includes riding, and the quickest run is the one with the least of it', () => {
    const history = [
        timed(trip(4000, 'Home', 'Uni', 600, 300), 1500),
        timed(trip(3000, 'Home', 'Uni', 600, 400), 1200),
        trip(2000, 'Home', 'Uni', 600, 200), // saved before end times existed
    ];
    const { runs, fastestStartedAt, quickestStartedAt } = matchTrips(history, history[0]);
    assert.deepEqual(runs.map(r => r.totalS), [1500, 1200, null]);
    assert.equal(quickestStartedAt, 3000);
    assert.equal(fastestStartedAt, 2000); // walking speed is judged on its own
});

test('no run is called quickest when fewer than two have a total time', () => {
    const history = [timed(trip(2000, 'Home', 'Uni', 600, 300), 900), trip(1000, 'Home', 'Uni', 600, 300)];
    assert.equal(matchTrips(history, history[0]).quickestStartedAt, null);
});

test('a trip with no steps matches nothing', () => {
    const empty: HistoryTrip = { startedAt: 9, legs: [], records: [], totals: { distanceM: 0, durationS: 0, topSpeedMps: 0 } };
    assert.deepEqual(matchTrips([empty], empty), { runs: [], fastestStartedAt: null, quickestStartedAt: null });
});
