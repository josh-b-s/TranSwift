import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupDepartures } from '@/services/gtfs/departures/departureGroups';
import type { Departure } from '@/services/gtfs/departures/stopDepartures';

const dep = (routeName: string, terminus: string, tripPk: number): Departure =>
    ({ routeName, routeType: 3, routeColor: '#000', routeTextColor: '#fff', terminus, tripPk, stopSequence: 1, dayStartMs: 0, timeMs: tripPk }) as Departure;

test('departures of one line and destination share a group, in order', () => {
    const groups = groupDepartures([dep('86', 'Bundoora', 1), dep('96', 'St Kilda', 2), dep('86', 'Bundoora', 3)]);
    assert.equal(groups.length, 2);
    assert.deepEqual(groups[0].departures.map(d => d.tripPk), [1, 3]);
});

test('the two directions of a line are separate groups', () => {
    const groups = groupDepartures([dep('86', 'Bundoora', 1), dep('86', 'City', 2)]);
    assert.deepEqual(groups.map(g => g.terminus), ['Bundoora', 'City']);
});

test('no departures gives no groups', () => {
    assert.deepEqual(groupDepartures([]), []);
});
