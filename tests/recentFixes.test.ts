import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addRecentFix, RECENT_MS } from '@/services/trips/recentFixes';

const fix = (accuracyM: number | null) => ({ latitude: -37.8, longitude: 144.9, accuracyM });

test('keeps a good fix with the time it arrived', () => {
    assert.deepEqual(addRecentFix([], fix(5), 1000), [{ latitude: -37.8, longitude: 144.9, time: 1000 }]);
});

test('leaves out fixes that are loose or have no accuracy', () => {
    assert.equal(addRecentFix([], fix(60), 1000).length, 0);
    assert.equal(addRecentFix([], fix(null), 1000).length, 0);
});

test('drops fixes older than the window', () => {
    const old = { latitude: -37.8, longitude: 144.9, time: 0 };
    const kept = addRecentFix([old], fix(5), RECENT_MS + 1);
    assert.equal(kept.length, 1);
    assert.equal(kept[0].time, RECENT_MS + 1);
});
