import { test } from 'node:test';
import assert from 'node:assert/strict';
import { followedEnough } from '@/services/trips/partialTrip';

test('a trip with no step finished is not worth saving', () => {
    assert.equal(followedEnough(0, 3), false);
});

test('less than half the steps is not enough', () => {
    assert.equal(followedEnough(1, 3), false);
    assert.equal(followedEnough(2, 5), false);
});

test('half the steps or more is enough', () => {
    assert.equal(followedEnough(2, 3), true);
    assert.equal(followedEnough(3, 5), true);
    assert.equal(followedEnough(1, 2), true);
});
