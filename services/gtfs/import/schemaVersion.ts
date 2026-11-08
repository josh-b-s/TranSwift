/** Must equal GTFS_SCHEMA_VERSION in modules/gtfs-importer/rust/src/schema.rs; tests/schemaVersion.test.ts checks it. */
export const REQUIRED_SCHEMA_VERSION = 1;

type Versioned = { schemaVersion?: number };

/** Entries saved before versions existed were built with version 1. */
export const schemaVersionOf = (entry: Versioned): number => entry.schemaVersion ?? 1;

export const isCurrentSchema = (entry: Versioned): boolean => schemaVersionOf(entry) === REQUIRED_SCHEMA_VERSION;
