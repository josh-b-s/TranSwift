import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPace, formatPaceDelta } from '@/services/trips/tripFormat';
import { paceAgainstBest } from '@/services/trips/livePace';
import { pathStats } from '@/services/trips/pathStats';
import { makeKey, parseKey } from '@/services/gtfs/core/gtfsKeyUtil';

test('formatPace turns speed into minutes per km or mile', () => {
    assert.equal(formatPace(2, 'kmh'), '8:20 /km');
    assert.equal(formatPace(0, 'kmh'), '--');
});

test('formatPaceDelta reads ahead, behind and on pace', () => {
    assert.equal(formatPaceDelta(12), '12s ahead');
    assert.equal(formatPaceDelta(-75), '1m 15s behind');
    assert.equal(formatPaceDelta(0.4), 'On pace');
});

test('paceAgainstBest waits for 50 m, then compares with an even pace', () => {
    assert.equal(paceAgainstBest({ distanceM: 30, elapsedS: 20 }, 1.5), null);
    // 150 m at 1.5 m/s takes 100 s, so 90 s elapsed is 10 s ahead.
    assert.equal(paceAgainstBest({ distanceM: 150, elapsedS: 90 }, 1.5), 10);
});

test('pathStats measures distance, duration and average speed', () => {
    // 0.001 degrees of latitude is about 111 m.
    const samples = [0, 1, 2, 3].map(i => ({ latitude: -37.8 + i * 0.001, longitude: 144.9, time: i * 10_000 }));
    const stats = pathStats(samples);
    assert.ok(Math.abs(stats.distanceM - 333) < 3);
    assert.equal(stats.durationS, 30);
    assert.ok(Math.abs(stats.avgSpeedMps - 11.1) < 0.2);
    assert.equal(stats.topSpeedMps, 0); // above the plausible-walking cap, so discarded
});

test('keys round-trip even when the id contains a colon', () => {
    assert.deepEqual(parseKey(makeKey(3, 'stop:12')), { agency: 3, id: 'stop:12' });
});
