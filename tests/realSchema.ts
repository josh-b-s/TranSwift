import { readFileSync } from 'node:fs';

// The schema the on-device importer builds (scripts/gtfsSchema.ts is the older desktop one and differs, e.g. in
// stop_times' key and indexes), so queries are checked against the tables they actually run on. Run from the project root.
const dir = 'modules/gtfs-importer/rust';
export const REAL_SCHEMA_SQL = readFileSync(`${dir}/schema.sql`, 'utf8');
export const REAL_INDEXES_SQL = readFileSync(`${dir}/indexes.sql`, 'utf8');
