import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    clampWalkDistance,
    DEFAULT_MAX_WALK_DISTANCE_M,
    MAX_MAX_WALK_DISTANCE_M,
    MIN_MAX_WALK_DISTANCE_M,
} from '@/constants/walkLimit';

test('clamps below the minimum and above the maximum', () => {
    assert.equal(clampWalkDistance(0), MIN_MAX_WALK_DISTANCE_M);
    assert.equal(clampWalkDistance(99_999), MAX_MAX_WALK_DISTANCE_M);
});

test('leaves in-range values alone', () => {
    assert.equal(clampWalkDistance(DEFAULT_MAX_WALK_DISTANCE_M), DEFAULT_MAX_WALK_DISTANCE_M);
});
