import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAllStopsCached, invalidateStopCache } from '@/services/gtfs/core/stopRepo';
import type { QueryableDb } from '@/services/db/queryableDb';

const row = (pk: number) =>
    ({ stop_pk: pk, stop_id: `s${pk}`, stop_name: `n${pk}`, stop_lat: -37_800_000, stop_lon: 144_900_000, agency: 1 });

function fakeDb(rows: object[], { delayMs = 5, failFirst = false } = {}) {
    let calls = 0;
    const db: QueryableDb = {
        getAllAsync: async <T>() => {
            const n = calls++;
            await new Promise(r => setTimeout(r, delayMs));
            if (failFirst && n === 0) throw new Error('boom');
            return rows as T[];
        },
        execAsync: async () => {},
        runAsync: async () => ({ lastInsertRowId: 0, changes: 0 }),
    };
    return { db, calls: () => calls };
}

test('concurrent callers share one query and the coordinates are unpacked', async () => {
    invalidateStopCache();
    const { db, calls } = fakeDb([row(1)]);
    const [a, b] = await Promise.all([getAllStopsCached(db), getAllStopsCached(db)]);
    assert.equal(calls(), 1);
    assert.equal(a, b);
    assert.ok(Math.abs(a[0].stop_lat - -37.8) < 1e-9);
    assert.ok(Math.abs(a[0].stop_lon - 144.9) < 1e-9);
    await getAllStopsCached(db);
    assert.equal(calls(), 1);
});

test('reloads after the cache is invalidated', async () => {
    invalidateStopCache();
    await getAllStopsCached(fakeDb([row(1)]).db);
    invalidateStopCache();
    const stops = await getAllStopsCached(fakeDb([row(2)]).db);
    assert.equal(stops[0].stop_pk, 2);
});

test('a load that finishes after invalidation does not fill the cache', async () => {
    invalidateStopCache();
    const slow = getAllStopsCached(fakeDb([row(10)], { delayMs: 40 }).db);
    invalidateStopCache();
    const next = fakeDb([row(20)]);
    await getAllStopsCached(next.db);
    await slow;
    const cached = await getAllStopsCached(next.db);
    assert.equal(cached[0].stop_pk, 20);
    assert.equal(next.calls(), 1);
});

test('a failed load is retried on the next call', async () => {
    invalidateStopCache();
    const flaky = fakeDb([row(30)], { failFirst: true });
    await assert.rejects(getAllStopsCached(flaky.db), /boom/);
    const stops = await getAllStopsCached(flaky.db);
    assert.equal(stops[0].stop_pk, 30);
});
