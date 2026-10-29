import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withQuery } from '@/services/gtfs/realtime/realtimeHttp';

test('adds the key to a URL with no query string', () => {
    assert.equal(withQuery('https://x/tu', 'apikey=abc123'), 'https://x/tu?apikey=abc123');
});

test('adds the key after an existing query string', () => {
    assert.equal(withQuery('https://x/tu?agency=1', ' apikey = abc123 '), 'https://x/tu?agency=1&apikey=abc123');
});

test('leaves the URL alone when it already has the parameter', () => {
    assert.equal(withQuery('https://x/tu?apikey=old', 'apikey=new'), 'https://x/tu?apikey=old');
    assert.equal(withQuery('https://x/tu?a=1&key.id=old', 'key.id=new'), 'https://x/tu?a=1&key.id=old');
});

test('leaves the URL alone when the key is missing or incomplete', () => {
    for (const query of [undefined, '', '   ', 'apikey', 'apikey=', '=abc']) {
        assert.equal(withQuery('https://x/tu', query), 'https://x/tu');
    }
});

test('a parameter that merely ends with the same name is not a match', () => {
    assert.equal(withQuery('https://x/tu?myapikey=1', 'apikey=abc'), 'https://x/tu?myapikey=1&apikey=abc');
});

test('a parameter name with regex characters is matched literally', () => {
    assert.equal(withQuery('https://x/tu?aab=1', 'a+b=x'), 'https://x/tu?aab=1&a+b=x');
    assert.equal(withQuery('https://x/tu?a+b=1', 'a+b=x'), 'https://x/tu?a+b=1');
});
