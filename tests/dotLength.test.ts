import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dotHalfLengthDeg } from '@/services/geo/dotLength';

test('shrinks as the map zooms in', () => {
    assert.ok(dotHalfLengthDeg(0.0005) < dotHalfLengthDeg(0.02));
});

test('stays the same within one zoom step, so circles are not redrawn on every pan', () => {
    assert.equal(dotHalfLengthDeg(0.0100), dotHalfLengthDeg(0.0105));
});
