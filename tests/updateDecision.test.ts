import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    hasNewerVersion,
    isCheckDue,
    shouldCheckForUpdate,
    UPDATE_CHECK_INTERVAL_MS,
} from '@/services/gtfs/update/updateDecision';

test('a changed etag is a newer version', () => {
    assert.equal(hasNewerVersion({ etag: '"a"' }, { etag: '"b"' }), true);
    assert.equal(hasNewerVersion({ etag: '"a"' }, { etag: '"a"' }), false);
});

test('falls back to last-modified when there is no etag to compare', () => {
    assert.equal(hasNewerVersion({ lastModified: 'Mon' }, { lastModified: 'Tue' }), true);
    assert.equal(hasNewerVersion({ etag: '"a"', lastModified: 'Mon' }, { lastModified: 'Tue' }), true);
    assert.equal(hasNewerVersion({ lastModified: 'Mon' }, { lastModified: 'Mon' }), false);
});

test('a feed saved without validators is never newer', () => {
    assert.equal(hasNewerVersion({}, { etag: '"a"', lastModified: 'Tue' }), false);
});

test('a check is due when never run or the interval has passed', () => {
    const now = 10 * UPDATE_CHECK_INTERVAL_MS;
    assert.equal(isCheckDue(undefined, now), true);
    assert.equal(isCheckDue(now - UPDATE_CHECK_INTERVAL_MS, now), true);
    assert.equal(isCheckDue(now - UPDATE_CHECK_INTERVAL_MS + 1, now), false);
});

test('checks only with consent, on wifi, when due', () => {
    const base = { consented: true, connection: 'wifi' as const, lastCheckedAt: undefined, now: 1000 };
    assert.equal(shouldCheckForUpdate(base), true);
    assert.equal(shouldCheckForUpdate({ ...base, consented: false }), false);
    assert.equal(shouldCheckForUpdate({ ...base, connection: 'cellular' }), false);
    assert.equal(shouldCheckForUpdate({ ...base, connection: 'none' }), false);
    assert.equal(shouldCheckForUpdate({ ...base, lastCheckedAt: 999 }), false);
});
