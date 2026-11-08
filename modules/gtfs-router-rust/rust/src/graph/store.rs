//! graph/store.rs — keeps the coarse graph in the database.
//!
//! TABLE NAMES: deliberately NOT the same `coarse_graph_meta` /
//! `coarse_graph_adjacency` tables the JS build persists to. Those are
//! keyed by TEXT stop_key (agency-qualified string); this Rust build is
//! keyed by INTEGER stop_pk directly (see repo.rs's module doc). Reusing
//! the same table names with an incompatible schema would risk exactly the
//! stale/cross-format load bug flagged in this codebase's own history —
//! using `rust_coarse_graph_meta` / `rust_coarse_graph_adjacency` instead
//! makes the two builds structurally incapable of reading each other's
//! data, even if the invalidation signature ever coincidentally matched.
//!
//! ENCODING: see edge_codec.rs. The blob is binary, with no string parsing on the load path.

use std::collections::HashMap;
use rusqlite::{params, Connection, OptionalExtension};
use crate::graph::coarse::CoarseEdge;
use crate::graph::edge_codec::{decode_edges, encode_edges};

/// Bumped whenever the algorithm that builds the adjacency changes, not
/// just when the underlying GTFS data does — same reasoning as TS's
/// GRAPH_ALGO_VERSION (a code change that produces different edges from the
/// same row counts must still force a rebuild).
///
/// v1 -> v2: CoarseEdge gained `distance_m` (real walk distance, no longer
/// discarded — see graph/coarse.rs), and the persisted record widened from
/// 17 to 25 bytes to carry it. Bumping this forces any device with an
/// existing v1 blob to fail the signature check and rebuild from scratch
/// instead of `decode_edges` silently producing `distance_m: 0.0` for
/// every persisted walk edge, which freq_raptor's walk-relax step would
/// have read as "zero distance, always in range" — a real correctness bug,
/// not just a missing feature, so a one-time forced rebuild is the right
/// trade here.
///
/// v2 -> v3: transit edges are now per (from, to, LINE) instead of
/// per (from, to), and the edge's `via_pattern` is the route's fastest
/// pattern for that stop pair. The record layout is unchanged, but a v2
/// blob would silently keep the old one-edge-per-pair graph, so force a rebuild.
///
/// v3 -> v4: the persisted record is varint packed (graph/edge_codec.rs), a different layout from v3.
const RUST_GRAPH_ALGO_VERSION: i64 = 4;

pub struct GraphSignature {
    pub stop_count: i64,
    pub pattern_stop_count: i64,
}

pub fn compute_graph_signature(conn: &Connection) -> rusqlite::Result<GraphSignature> {
    let stop_count: i64 = conn.query_row("SELECT COUNT(*) FROM stops", [], |r| r.get(0))?;
    let pattern_stop_count: i64 = conn.query_row("SELECT COUNT(*) FROM pattern_stops", [], |r| r.get(0))?;
    Ok(GraphSignature { stop_count, pattern_stop_count })
}

fn signature_key(sig: &GraphSignature) -> String {
    format!("{RUST_GRAPH_ALGO_VERSION}:{}:{}", sig.stop_count, sig.pattern_stop_count)
}

fn ensure_tables(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS rust_coarse_graph_meta (
            key   TEXT PRIMARY KEY,
            value TEXT
         );
         CREATE TABLE IF NOT EXISTS rust_coarse_graph_adjacency (
            stop_pk INTEGER PRIMARY KEY,
            edges   BLOB NOT NULL
         );",
    )
}

/// Attempts to load a previously persisted graph matching `signature`.
/// Returns None on any mismatch/absence — caller falls back to a full
/// rebuild (which also re-persists).
pub fn load_persisted_graph(
    conn: &Connection,
    signature: &GraphSignature,
) -> rusqlite::Result<Option<HashMap<i64, Vec<CoarseEdge>>>> {
    ensure_tables(conn)?;

    let stored: Option<String> = conn
        .query_row("SELECT value FROM rust_coarse_graph_meta WHERE key = 'signature'", [], |r| r.get(0))
        .optional()?;
    if stored.as_deref() != Some(signature_key(signature).as_str()) {
        return Ok(None);
    }

    let mut stmt = conn.prepare("SELECT stop_pk, edges FROM rust_coarse_graph_adjacency")?;
    let rows = stmt.query_map([], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, Vec<u8>>(1)?)))?;
    let mut adjacency = HashMap::new();
    let mut any = false;
    for row in rows {
        let (stop_pk, blob) = row?;
        any = true;
        let Some(edges) = decode_edges(stop_pk, &blob) else { return Ok(None) }; // corrupt blob: rebuild
        adjacency.insert(stop_pk, edges);
    }
    if !any { return Ok(None); } // stale/half-written — treat as a miss, rebuild

    Ok(Some(adjacency))
}

/// Persists a freshly-built graph, replacing whatever was stored before.
/// Runs as one transaction so a crash mid-write can't leave a half-written
/// store that still matches the signature.
pub fn save_persisted_graph(
    conn: &mut Connection,
    signature: &GraphSignature,
    adjacency: &HashMap<i64, Vec<CoarseEdge>>,
) -> rusqlite::Result<()> {
    ensure_tables(conn)?;

    let tx = conn.transaction()?;
    tx.execute("DELETE FROM rust_coarse_graph_adjacency", [])?;
    tx.execute("DELETE FROM rust_coarse_graph_meta", [])?;
    {
        let mut ins = tx.prepare("INSERT INTO rust_coarse_graph_adjacency (stop_pk, edges) VALUES (?, ?)")?;
        for (stop_pk, edges) in adjacency {
            let blob = encode_edges(*stop_pk, edges);
            ins.execute(params![stop_pk, blob])?;
        }
    }
    tx.execute(
        "INSERT INTO rust_coarse_graph_meta (key, value) VALUES ('signature', ?)",
        params![signature_key(signature)],
    )?;
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::coarse::EdgeKind;

    fn conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("CREATE TABLE stops (stop_pk INTEGER); CREATE TABLE pattern_stops (pattern_pk INTEGER);").unwrap();
        conn
    }

    fn graph() -> HashMap<i64, Vec<CoarseEdge>> {
        let walk = CoarseEdge { to: 2, kind: EdgeKind::Walk, cost: 0.5, distance_m: 812.25, via_pattern: None };
        let transit = CoarseEdge { to: 1, kind: EdgeKind::Transit, cost: 1.0, distance_m: 0.0, via_pattern: Some(7) };
        HashMap::from([(1, vec![walk]), (2, vec![transit])])
    }

    #[test]
    fn a_saved_graph_loads_back_with_the_same_edges() {
        let mut conn = conn();
        let signature = compute_graph_signature(&conn).unwrap();
        save_persisted_graph(&mut conn, &signature, &graph()).unwrap();
        let loaded = load_persisted_graph(&conn, &signature).unwrap().expect("a matching signature loads");
        assert_eq!(loaded[&1][0].distance_m, 812.25);
        assert_eq!(loaded[&1][0].kind, EdgeKind::Walk);
        assert_eq!(loaded[&2][0].via_pattern, Some(7));
        assert_eq!(loaded[&2][0].to, 1);
    }

    #[test]
    fn a_corrupt_blob_is_treated_as_a_miss() {
        let mut conn = conn();
        let signature = compute_graph_signature(&conn).unwrap();
        save_persisted_graph(&mut conn, &signature, &graph()).unwrap();
        conn.execute("UPDATE rust_coarse_graph_adjacency SET edges = x'ff' WHERE stop_pk = 1", []).unwrap();
        assert!(load_persisted_graph(&conn, &signature).unwrap().is_none());
    }
}
