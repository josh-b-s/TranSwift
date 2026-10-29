import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeAuth, reportAuthFailure, setAuthFailureListener } from '@/services/gtfs/realtime/authFailure';
import { RealtimeHttpError } from '@/services/gtfs/realtime/realtimeHttp';
import type { GtfsDatabaseEntry } from '@/services/gtfs/import/gtfsDbRegistry';

const entry = (id: string) => ({ id, name: id }) as GtfsDatabaseEntry;
const rejected = (status: number): PromiseSettledResult<unknown> => ({ status: 'rejected', reason: new RealtimeHttpError(status) });
const ok: PromiseSettledResult<unknown> = { status: 'fulfilled', value: new ArrayBuffer(0) };

test('reports a 401 once per feed', () => {
    const seen: string[] = [];
    setAuthFailureListener((e) => seen.push(e.id));
    reportAuthFailure(entry('a'), [ok, rejected(401)]);
    reportAuthFailure(entry('a'), [rejected(403)]);
    assert.deepEqual(seen, ['a']);
    setAuthFailureListener(null);
});

test('ignores other failures', () => {
    const seen: string[] = [];
    setAuthFailureListener((e) => seen.push(e.id));
    reportAuthFailure(entry('b'), [rejected(500), { status: 'rejected', reason: new Error('offline') }, ok]);
    assert.deepEqual(seen, []);
    setAuthFailureListener(null);
});

test('does not use up the report while nothing is listening', () => {
    reportAuthFailure(entry('c'), [rejected(401)]);
    const seen: string[] = [];
    setAuthFailureListener((e) => seen.push(e.id));
    reportAuthFailure(entry('c'), [rejected(401)]);
    assert.deepEqual(seen, ['c']);
    setAuthFailureListener(null);
});

test('says where the key goes', () => {
    assert.match(describeAuth({ kind: 'header', name: 'x-api-key' }), /"x-api-key" header/);
    assert.match(describeAuth({ kind: 'query', name: 'apikey' }), /apikey=<your key>/);
    assert.match(describeAuth(undefined), /may want an API key/);
});
