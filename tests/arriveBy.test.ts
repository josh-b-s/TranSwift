import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arriveBySearch } from '@/services/gtfs/router/arriveBy';
import type { GtfsJourney } from '@/services/gtfs/router/routeTypes';

const MIN = 60_000;
const at = (h: number, m = 0) => new Date(2026, 10, 9, h, m, 0, 0);
const clock = (ms: number) => {
    const d = new Date(ms);
    return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
};

/** A timetable with a ride every `everyMin` minutes taking `rideMin`, the first at 06:00. A search finds the next one. */
function timetable(everyMin: number, rideMin: number) {
    let searches = 0;
    const search = async (start: Date): Promise<GtfsJourney[]> => {
        searches++;
        const first = at(6).getTime();
        const k = Math.max(0, Math.ceil((start.getTime() - first) / (everyMin * MIN)));
        const leave = first + k * everyMin * MIN;
        return [{ departureTime: clock(leave), arrivalTime: clock(leave + rideMin * MIN), totalDurationMin: rideMin } as GtfsJourney];
    };
    return { search, count: () => searches };
}

test('picks the latest ride that still arrives in time', async () => {
    const { search } = timetable(20, 25);
    // Deadline 09:00. Rides leave on the 20s: 08:20 arrives 08:45, 08:40 arrives 09:05 (too late).
    const journeys = await arriveBySearch(search, at(9).getTime(), at(7).getTime());
    assert.equal(journeys.length, 1);
    assert.equal(journeys[0].departureTime, '08:20:00');
});

test('keeps looking further back when the first guess is too late', async () => {
    const { search } = timetable(30, 90);
    const journeys = await arriveBySearch(search, at(10).getTime(), at(6).getTime());
    assert.equal(journeys[0].departureTime, '08:30:00');
});

test('nothing arrives in time gives no journeys', async () => {
    const { search } = timetable(20, 25);
    assert.deepEqual(await arriveBySearch(search, at(7).getTime(), at(6, 50).getTime()), []);
});

test('stays within a handful of searches', async () => {
    const { search, count } = timetable(5, 30);
    await arriveBySearch(search, at(12).getTime(), at(6).getTime());
    assert.ok(count() <= 6);
});

test('never searches from before now', async () => {
    const starts: number[] = [];
    await arriveBySearch(async d => { starts.push(d.getTime()); return []; }, at(9).getTime(), at(8, 50).getTime());
    assert.ok(starts.every(s => s >= at(8, 50).getTime()));
});
