import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feedsInRegion, largestFirst } from '@/services/gtfs/catalog/catalogFilter';
import type { CatalogFeed } from '@/services/gtfs/catalog/catalogParse';

const feed = (id: string, subdivision = 'Victoria', box: CatalogFeed['box'] = null): CatalogFeed => ({
    id, provider: id, name: '', country: 'AU', subdivision, municipality: '', zipUrl: `https://x/${id}.zip`, licenseUrl: '', box,
});

test('largestFirst puts the biggest zip first', () => {
    const feeds = [feed('skybus'), feed('ptv'), feed('ferry')];
    assert.deepEqual(largestFirst(feeds, [2_000_000, 250_000_000, 500_000]).map(f => f.id), ['ptv', 'skybus', 'ferry']);
});

test('largestFirst keeps unmeasured feeds last and in their original order', () => {
    const feeds = [feed('a'), feed('b'), feed('c'), feed('d')];
    assert.deepEqual(largestFirst(feeds, [null, 10, null, 20]).map(f => f.id), ['d', 'b', 'a', 'c']);
});

test('largestFirst leaves the order alone when nothing could be measured', () => {
    const feeds = [feed('a'), feed('b')];
    assert.deepEqual(largestFirst(feeds, [null, null]).map(f => f.id), ['a', 'b']);
});

test('feedsInRegion only offers feeds without a box, in that region', () => {
    const box = { minLat: 0, maxLat: 1, minLon: 0, maxLon: 1 };
    const feeds = [feed('ptv'), feed('boxed', 'Victoria', box), feed('other', 'Tasmania')];
    assert.deepEqual(feedsInRegion(feeds, { country: 'au', subdivision: 'victoria' }).map(f => f.id), ['ptv']);
});
