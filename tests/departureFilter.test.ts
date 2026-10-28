import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    applyDepartureFilter,
    filterLines,
    filterTermini,
    NO_FILTER,
    pickLine,
} from '@/services/gtfs/departures/departureFilter';
import type { Departure } from '@/services/gtfs/departures/stopDepartures';

const dep = (routeName: string, terminus: string, timeMs: number): Departure => ({
    timeMs, routeName, routeType: 0, terminus, routeColor: '#000000', routeTextColor: '#FFFFFF', tripPk: timeMs, stopSequence: 1, dayStartMs: 0,
});

const all = [dep('96', 'Brunswick', 1), dep('86', 'Bundoora', 2), dep('96', 'St Kilda', 3), dep('86', 'Docklands', 4)];

test('lists lines and destinations without repeats', () => {
    assert.deepEqual(filterLines(all), ['96', '86']);
    assert.deepEqual(filterTermini(all, null), ['Brunswick', 'Bundoora', 'St Kilda', 'Docklands']);
    assert.deepEqual(filterTermini(all, '96'), ['Brunswick', 'St Kilda']);
});

test('filters by line, destination or both, keeping the order', () => {
    assert.equal(applyDepartureFilter(all, NO_FILTER).length, 4);
    assert.deepEqual(applyDepartureFilter(all, { line: '96', terminus: null }).map(d => d.timeMs), [1, 3]);
    assert.deepEqual(applyDepartureFilter(all, { line: null, terminus: 'Docklands' }).map(d => d.timeMs), [4]);
    assert.equal(applyDepartureFilter(all, { line: '96', terminus: 'Docklands' }).length, 0);
});

test('picking a line drops a destination it does not serve', () => {
    assert.deepEqual(pickLine({ line: null, terminus: 'Docklands' }, all, '96'), { line: '96', terminus: null });
    assert.deepEqual(pickLine({ line: null, terminus: 'St Kilda' }, all, '96'), { line: '96', terminus: 'St Kilda' });
    assert.deepEqual(pickLine({ line: '96', terminus: null }, all, null), NO_FILTER);
});
