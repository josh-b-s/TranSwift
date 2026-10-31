import { test } from 'node:test';
import assert from 'node:assert/strict';
import { darken } from '@/services/color/darken';

test('each channel is scaled down', () => {
    assert.equal(darken('#ff8000', 0.5), '#804000');
    assert.equal(darken('#ffffff', 0), '#ffffff');
});

test('short and unprefixed hex both work', () => {
    assert.equal(darken('f80', 0.5), '#804400');
    assert.equal(darken('00A9E0', 0.5), '#005570');
});

test('anything that is not hex comes back as it was', () => {
    assert.equal(darken('red', 0.5), 'red');
    assert.equal(darken('', 0.5), '');
});
