import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthGrid, shiftMonth, tripsOnDay } from '@/services/trips/calendarMonth';
import type { HistoryTrip } from '@/services/trips/tripHistory';

const trip = (y: number, m: number, d: number, hour: number, distanceM: number) =>
    ({ startedAt: new Date(y, m, d, hour).getTime(), totals: { distanceM, durationS: 60, topSpeedMps: 1 }, legs: [] }) as unknown as HistoryTrip;

// November 2026 starts on a Sunday, so a Monday-first grid has six leading days and spans six weeks.
const NOV = new Date(2026, 10, 1).getTime();

test('lays the month out in whole weeks starting on Monday', () => {
    const grid = monthGrid(NOV, []);
    assert.equal(grid.length, 6);
    assert.ok(grid.every(week => week.length === 7));
    assert.equal(new Date(grid[0][0].dayMs).getDay(), 1);
    assert.equal(grid[0].filter(c => c.inMonth).length, 1);
    assert.equal(new Date(grid[0][6].dayMs).getDate(), 1);
});

test('adds up the trips on each day', () => {
    const grid = monthGrid(NOV, [trip(2026, 10, 5, 8, 400), trip(2026, 10, 5, 18, 600), trip(2026, 9, 31, 9, 900)]);
    const cells = grid.flat();
    const fifth = cells.find(c => c.inMonth && new Date(c.dayMs).getDate() === 5)!;
    assert.deepEqual([fifth.tripCount, fifth.distanceM], [2, 1000]);
    // 31 October shows in the leading days, so its trip is counted there too.
    assert.equal(cells.find(c => !c.inMonth && new Date(c.dayMs).getDate() === 31)!.tripCount, 1);
});

test('moves between months across a year end', () => {
    assert.equal(new Date(shiftMonth(new Date(2026, 11, 20).getTime(), 1)).getFullYear(), 2027);
    assert.equal(new Date(shiftMonth(NOV, -11)).getMonth(), 11);
});

test('picks out the trips of one day', () => {
    const trips = [trip(2026, 10, 5, 18, 1), trip(2026, 10, 5, 8, 1), trip(2026, 10, 6, 8, 1)];
    assert.equal(tripsOnDay(trips, new Date(2026, 10, 5).getTime()).length, 2);
});
