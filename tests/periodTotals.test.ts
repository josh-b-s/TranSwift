import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chartPoints, walkingStreak, weekDistanceM, weekStart } from '@/services/trips/periodTotals';
import type { HistoryTrip } from '@/services/trips/tripHistory';

// Oct 28 2026 is a Wednesday, so its week starts on Monday Oct 26.
const at = (month: number, day: number, hour = 9) => new Date(2026, month, day, hour).getTime();
const NOW = at(9, 28, 15);

const trip = (startedAt: number, distanceM: number, durationS = distanceM): HistoryTrip => ({
    startedAt, legs: [], records: [], totals: { distanceM, durationS, topSpeedMps: 0 },
});

test('weeks start on Monday at local midnight', () => {
    assert.equal(weekStart(at(9, 28)), new Date(2026, 9, 26).getTime());
    assert.equal(weekStart(at(9, 25, 23)), new Date(2026, 9, 19).getTime()); // Sunday belongs to the week before
});

test('weekly points cover the last 8 weeks, empty ones included', () => {
    const trips = [trip(at(9, 27), 3000), trip(at(9, 26), 1000), trip(at(9, 20), 500)];
    const points = chartPoints(trips, 'weeks', NOW);
    assert.equal(points.length, 8);
    assert.equal(points[7].startMs, weekStart(NOW));
    assert.equal(points[7].distanceM, 4000);
    assert.equal(points[6].distanceM, 500);
    assert.equal(points[5].distanceM, 0);
});

test('monthly points cross a year boundary and ignore trips outside the window', () => {
    const points = chartPoints([trip(at(0, 5), 900), trip(at(9, 2), 100)], 'months', new Date(2026, 1, 10).getTime());
    assert.deepEqual(points.map(p => new Date(p.startMs).getMonth()), [8, 9, 10, 11, 0, 1]);
    assert.equal(points[4].distanceM, 900);
    assert.equal(points.reduce((sum, p) => sum + p.distanceM, 0), 900);
});

test('trip points are the latest walked trips, oldest first', () => {
    const trips = [trip(at(9, 28), 0), trip(at(9, 27), 700), trip(at(9, 26), 300)];
    assert.deepEqual(chartPoints(trips, 'trips', NOW).map(p => p.distanceM), [300, 700]);
});

test('week distance counts only this week', () => {
    assert.equal(weekDistanceM([trip(at(9, 27), 2500), trip(at(9, 25), 9000)], NOW), 2500);
});

test('streak counts back from today, or from yesterday while today is empty', () => {
    const days = (...d: number[]) => d.map(day => trip(at(9, day), 400));
    assert.equal(walkingStreak(days(28, 27, 26, 24), NOW), 3);
    assert.equal(walkingStreak(days(27, 26), NOW), 2);
    assert.equal(walkingStreak(days(26), NOW), 0);
    assert.equal(walkingStreak([trip(at(9, 28), 0)], NOW), 0);
    assert.equal(walkingStreak([], NOW), 0);
});

test('streak runs across a month end', () => {
    const trips = [trip(at(10, 1), 400), trip(at(9, 31), 400), trip(at(9, 30), 400)];
    assert.equal(walkingStreak(trips, at(10, 1, 20)), 3);
});
