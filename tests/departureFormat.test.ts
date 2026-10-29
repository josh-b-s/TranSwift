import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatClock, formatDepartureIn, formatStopsAway } from '@/services/gtfs/departures/departureFormat';

const MIN = 60_000;
const now = new Date(2026, 9, 26, 10, 0, 0).getTime();

test('under a minute away reads Now', () => {
    assert.equal(formatDepartureIn(now + 20_000, now), 'Now');
    assert.equal(formatDepartureIn(now - MIN, now), 'Now');
});

test('minutes are rounded to the nearest', () => {
    assert.equal(formatDepartureIn(now + 5 * MIN, now), '5 min');
    assert.equal(formatDepartureIn(now + 4.6 * MIN, now), '5 min');
    assert.equal(formatDepartureIn(now + 59 * MIN, now), '59 min');
});

test('an hour or more away switches to the clock time', () => {
    assert.equal(formatDepartureIn(now + 60 * MIN, now), formatClock(now + 60 * MIN));
});

test('stops away reads as a count, or arriving when it is the next stop', () => {
    assert.equal(formatStopsAway(0), 'Arriving');
    assert.equal(formatStopsAway(1), '1 stop away');
    assert.equal(formatStopsAway(4), '4 stops away');
});
