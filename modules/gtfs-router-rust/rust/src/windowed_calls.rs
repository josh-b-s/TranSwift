//! windowed_calls.rs — the scheduled calls at a set of stops inside a time window, read from stop_time_chunks.
//!
//! SQL cannot look inside the chunk blobs, so it picks the chunks that can hold calls in the window and this
//! module decodes them and drops the rest. A chunk can hold calls in [lo, hi] when it starts at or before hi
//! and either starts at or after lo, or is the last chunk of its stop that starts before lo (its calls run on
//! past its first one). Both bounds are range seeks on the table's primary key (stop_pk, first_dep, chunk_idx).

use rusqlite::Connection;
use crate::stop_time_codec::{decode_chunk, StopTimeRow};

/// Chunks of the stops listed in the temp table `corridor_stop_pks(id)`. CROSS JOIN pins the corridor as the outer loop, or the planner scans every chunk.
const CHUNKS_IN_WINDOW_SQL: &str = "\
    SELECT c.stop_pk, c.first_dep, c.data \
    FROM corridor_stop_pks k \
    CROSS JOIN stop_time_chunks c ON c.stop_pk = k.id \
     AND c.first_dep BETWEEN COALESCE((SELECT MAX(p.first_dep) FROM stop_time_chunks p \
                                       WHERE p.stop_pk = k.id AND p.first_dep < ?1), 0) AND ?2";

/// (stop_pk, call) for every call with `lo <= departure_sec <= hi` at the stops in `corridor_stop_pks`.
/// Order is by stop, then departure. A chunk that does not decode is an error, so the search fails
/// instead of quietly running on part of the timetable.
pub fn fetch_windowed_calls(conn: &Connection, lo: i64, hi: i64) -> rusqlite::Result<Vec<(i64, StopTimeRow)>> {
    let mut stmt = conn.prepare_cached(CHUNKS_IN_WINDOW_SQL)?;
    let mut chunks = stmt.query([lo, hi])?;
    let mut out = Vec::new();
    while let Some(chunk) = chunks.next()? {
        let (stop_pk, first_dep, data): (i64, i64, Vec<u8>) = (chunk.get(0)?, chunk.get(1)?, chunk.get(2)?);
        let calls = decode_chunk(first_dep, &data).ok_or_else(|| {
            rusqlite::Error::FromSqlConversionFailure(2, rusqlite::types::Type::Blob, format!("stop {stop_pk} chunk at {first_dep} is cut short").into())
        })?;
        out.extend(calls.into_iter().filter(|c| (lo..=hi).contains(&c.departure_sec)).map(|c| (stop_pk, c)));
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::stop_time_codec::encode_chunk;

    fn db_with_corridor(corridor: &[i64]) -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE stop_time_chunks (stop_pk INTEGER NOT NULL, first_dep INTEGER NOT NULL, chunk_idx INTEGER NOT NULL, \
                 data BLOB NOT NULL, PRIMARY KEY (stop_pk, first_dep, chunk_idx)) WITHOUT ROWID; \
             CREATE TEMP TABLE corridor_stop_pks (id INTEGER PRIMARY KEY);",
        ).unwrap();
        for id in corridor { conn.execute("INSERT INTO corridor_stop_pks (id) VALUES (?)", [id]).unwrap(); }
        conn
    }

    /// Stores a stop's calls the way the importer does, `rows_per_chunk` to a chunk.
    fn store(conn: &Connection, stop_pk: i64, mut calls: Vec<StopTimeRow>, rows_per_chunk: usize) {
        calls.sort_by_key(|c| (c.departure_sec, c.trip_pk, c.stop_sequence));
        for (idx, chunk) in calls.chunks(rows_per_chunk).enumerate() {
            let first = chunk[0].departure_sec;
            conn.execute("INSERT INTO stop_time_chunks VALUES (?, ?, ?, ?)", rusqlite::params![stop_pk, first, idx as i64, encode_chunk(first, chunk)]).unwrap();
        }
    }

    fn call(departure_sec: i64, trip_pk: i64) -> StopTimeRow {
        StopTimeRow { departure_sec, trip_pk, stop_sequence: 1, dwell_sec: 0, pickup_type: 0, drop_off_type: 0 }
    }

    fn departures(found: &[(i64, StopTimeRow)], stop_pk: i64) -> Vec<i64> {
        found.iter().filter(|(s, _)| *s == stop_pk).map(|(_, c)| c.departure_sec).collect()
    }

    #[test]
    fn a_call_inside_a_chunk_that_starts_before_the_window_is_found() {
        let conn = db_with_corridor(&[1]);
        // Chunks of 4: starts at 0, 400, 800. The window starts inside the second chunk.
        store(&conn, 1, (0..12).map(|i| call(i * 100, i)).collect(), 4);
        let found = fetch_windowed_calls(&conn, 550, 850).unwrap();
        assert_eq!(departures(&found, 1), vec![600, 700, 800]);
    }

    #[test]
    fn only_stops_in_the_corridor_are_read() {
        let conn = db_with_corridor(&[1]);
        store(&conn, 1, vec![call(100, 1)], 4);
        store(&conn, 2, vec![call(100, 2)], 4);
        let found = fetch_windowed_calls(&conn, 0, 1000).unwrap();
        assert_eq!(found.iter().map(|(s, _)| *s).collect::<Vec<_>>(), vec![1]);
    }

    #[test]
    fn the_window_ends_are_inclusive_and_an_empty_window_finds_nothing() {
        let conn = db_with_corridor(&[1]);
        store(&conn, 1, (0..10).map(|i| call(i * 100, i)).collect(), 3);
        assert_eq!(departures(&fetch_windowed_calls(&conn, 300, 500).unwrap(), 1), vec![300, 400, 500]);
        assert!(fetch_windowed_calls(&conn, 301, 399).unwrap().is_empty());
        assert!(fetch_windowed_calls(&conn, 5_000, 6_000).unwrap().is_empty());
    }

    #[test]
    fn chunks_that_share_a_first_departure_are_all_read() {
        let conn = db_with_corridor(&[1]);
        // Six calls at the same second, three to a chunk, then later ones.
        let mut calls: Vec<StopTimeRow> = (0..6).map(|t| call(1_000, t)).collect();
        calls.extend((0..3).map(|i| call(2_000 + i, 10 + i)));
        store(&conn, 1, calls, 3);
        assert_eq!(departures(&fetch_windowed_calls(&conn, 1_000, 1_000).unwrap(), 1), vec![1_000; 6]);
        assert_eq!(departures(&fetch_windowed_calls(&conn, 1_500, 2_001).unwrap(), 1), vec![2_000, 2_001]);
    }

    #[test]
    fn random_windows_match_a_plain_filter_of_every_call() {
        let mut state = 99u64;
        let mut next = |bound: u64| { state = state.wrapping_mul(6_364_136_223_846_793_005).wrapping_add(1_442_695_040_888_963_407); (state >> 33) % bound };
        let corridor = [1, 2, 3, 5];
        let conn = db_with_corridor(&corridor);
        let mut all: Vec<(i64, StopTimeRow)> = Vec::new();
        for stop_pk in 1..=6 {
            let calls: Vec<StopTimeRow> = (0..300).map(|_| call(next(20_000) as i64, next(50_000) as i64)).collect();
            all.extend(calls.iter().cloned().map(|c| (stop_pk, c)));
            store(&conn, stop_pk, calls, 8);
        }
        for _ in 0..200 {
            let lo = next(20_000) as i64;
            let hi = lo + next(5_000) as i64;
            let mut found: Vec<(i64, i64, i64)> = fetch_windowed_calls(&conn, lo, hi).unwrap().into_iter().map(|(s, c)| (s, c.departure_sec, c.trip_pk)).collect();
            let mut expected: Vec<(i64, i64, i64)> = all.iter().filter(|(s, c)| corridor.contains(s) && (lo..=hi).contains(&c.departure_sec)).map(|(s, c)| (*s, c.departure_sec, c.trip_pk)).collect();
            found.sort();
            expected.sort();
            assert_eq!(found, expected, "window {lo}..{hi}");
        }
    }

    #[test]
    fn a_cut_chunk_is_an_error() {
        let conn = db_with_corridor(&[1]);
        conn.execute("INSERT INTO stop_time_chunks VALUES (1, 100, 0, x'8001')", []).unwrap();
        assert!(fetch_windowed_calls(&conn, 0, 1_000).is_err());
    }

    #[test]
    fn the_query_seeks_the_primary_key_instead_of_scanning_the_table() {
        let conn = db_with_corridor(&[1]);
        let mut stmt = conn.prepare(&format!("EXPLAIN QUERY PLAN {CHUNKS_IN_WINDOW_SQL}")).unwrap();
        let plan: Vec<String> = stmt.query_map([0, 1], |r| r.get::<_, String>(3)).unwrap().map(Result::unwrap).collect();
        assert!(!plan.iter().any(|d| d.starts_with("SCAN c") || d.starts_with("SCAN stop_time_chunks")), "{plan:?}");
        assert!(plan.iter().any(|d| d.starts_with("SEARCH c USING PRIMARY KEY") && d.contains("first_dep")), "{plan:?}");
    }
}
