import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withinStartWindow } from '@/services/trips/startWindow';

const at = (h: number, m: number) => new Date(2026, 10, 1, h, m, 0);
// Leaves at 13:00, first vehicle at 13:16.
const ok = (now: Date) => withinStartWindow('13:00:00', '13:16:00', now);

test('is too early more than 20 minutes before departure', () => {
    assert.equal(ok(at(12, 30)), false);
});

test('opens 20 minutes before departure', () => {
    assert.equal(ok(at(12, 41)), true);
});

test('stays open until the first vehicle has gone', () => {
    assert.equal(ok(at(13, 10)), true);
    assert.equal(ok(at(13, 17)), true);
});

test('is stale once the first vehicle left a few minutes ago', () => {
    assert.equal(ok(at(13, 19)), false);
    assert.equal(ok(at(13, 45)), false);
});

test('a journey with no ride has no end to the window', () => {
    assert.equal(withinStartWindow('13:00:00', undefined, at(14, 30)), true);
});
