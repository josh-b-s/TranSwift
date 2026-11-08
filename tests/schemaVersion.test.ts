import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isCurrentSchema, REQUIRED_SCHEMA_VERSION, schemaVersionOf } from '@/services/gtfs/import/schemaVersion';

test('the app and the importer agree on the schema version', () => {
    const rust = readFileSync('modules/gtfs-importer/rust/src/schema.rs', 'utf8');
    const match = rust.match(/GTFS_SCHEMA_VERSION: i64 = (\d+);/);
    assert.equal(Number(match?.[1]), REQUIRED_SCHEMA_VERSION);
});

test('an entry saved before versions existed counts as version 1', () => {
    assert.equal(schemaVersionOf({}), 1);
});

test('only an entry built with the required version is current', () => {
    assert.equal(isCurrentSchema({ schemaVersion: REQUIRED_SCHEMA_VERSION }), true);
    assert.equal(isCurrentSchema({ schemaVersion: REQUIRED_SCHEMA_VERSION + 1 }), false);
    assert.equal(isCurrentSchema({ schemaVersion: REQUIRED_SCHEMA_VERSION - 1 }), false);
});
