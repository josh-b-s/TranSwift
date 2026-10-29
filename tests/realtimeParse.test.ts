import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRealtimeEndpoints } from '@/services/gtfs/catalog/realtimeParse';

const HEADER = 'id,data_type,status,entity_type,static_reference,urls.direct_download,urls.authentication_type,urls.api_key_parameter_name';

function csv(...rows: string[]) {
    return [HEADER, ...rows].join('\n');
}

test('collects trip update and vehicle position urls for the feed', () => {
    const text = csv(
        'mdb-10,gtfs,active,,,https://x/static.zip,0,',
        'mdb-11,gtfs_rt,active,tu,mdb-10,https://x/tu,0,',
        'mdb-12,gtfs_rt,active,vp,mdb-10,https://x/vp,0,',
        'mdb-13,gtfs_rt,active,sa,mdb-10,https://x/alerts,0,',
    );
    const found = parseRealtimeEndpoints(text, 'mdb-10');
    assert.deepEqual(found.tripUpdates, ['https://x/tu']);
    assert.deepEqual(found.vehiclePositions, ['https://x/vp']);
    assert.equal(found.auth, null);
});

test('ignores realtime feeds that point at other schedule feeds', () => {
    const text = csv('mdb-11,gtfs_rt,active,tu,mdb-99,https://x/tu,0,');
    assert.deepEqual(parseRealtimeEndpoints(text, 'mdb-10').tripUpdates, []);
});

test('matches ids with or without the mdb- prefix', () => {
    const text = csv('mdb-11,gtfs_rt,active,tu,10,https://x/tu,0,');
    assert.deepEqual(parseRealtimeEndpoints(text, 'mdb-10').tripUpdates, ['https://x/tu']);
});

test('one row can serve both entity types', () => {
    const text = csv('mdb-11,gtfs_rt,active,tu|vp,mdb-10,https://x/both,0,');
    const found = parseRealtimeEndpoints(text, 'mdb-10');
    assert.deepEqual(found.tripUpdates, ['https://x/both']);
    assert.deepEqual(found.vehiclePositions, ['https://x/both']);
});

test('reports the key a producer needs', () => {
    const text = csv('mdb-11,gtfs_rt,active,tu,mdb-10,https://x/tu,2,x-api-key');
    assert.deepEqual(parseRealtimeEndpoints(text, 'mdb-10').auth, { kind: 'header', name: 'x-api-key' });
});

test('returns nothing when the catalog lacks the realtime columns', () => {
    const found = parseRealtimeEndpoints('id,data_type\nmdb-10,gtfs', 'mdb-10');
    assert.deepEqual(found, { tripUpdates: [], vehiclePositions: [], auth: null });
});
