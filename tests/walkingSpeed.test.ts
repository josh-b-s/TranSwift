import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMps, walkingSpeedLabel } from '@/services/preferences/walkingSpeed';

test('a preset with a name reads as its name', () => {
    assert.equal(walkingSpeedLabel({ label: 'Normal', mps: 1.4 }), 'Normal');
});

test('a preset without a name reads as its speed', () => {
    assert.equal(walkingSpeedLabel({ mps: 1.4 }), '1.4 m/s');
});

test('a blank name counts as no name', () => {
    assert.equal(walkingSpeedLabel({ label: '   ', mps: 0.8 }), '0.8 m/s');
});

test('speeds show one decimal', () => {
    assert.equal(formatMps(1.25), '1.3 m/s');
});
