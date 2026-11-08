//! graph/edge_codec.rs — packs one stop's coarse edges into a small blob and back.
//!
//! Per edge: varint(zigzag(to - previous_to) << 1 | kind), then for a transit edge
//! varint(via_pattern + 1) with 0 meaning none, and for a walk edge the 8-byte distance_m.
//! `previous_to` starts at the stop's own pk, so neighbours with nearby pks cost 1 to 3 bytes.
//! Transit edges always carry distance 0.0 and walk edges never carry a pattern (see coarse.rs),
//! so those fields are not stored. Edge order is kept, because search tie-breaking follows it.

use crate::graph::coarse::{CoarseEdge, EdgeKind};

const WALK: u64 = 1;

fn put_varint(out: &mut Vec<u8>, mut n: u64) {
    while n >= 0x80 {
        out.push((n & 0x7f) as u8 | 0x80);
        n >>= 7;
    }
    out.push(n as u8);
}

fn read_varint(bytes: &[u8], pos: &mut usize) -> Option<u64> {
    let mut n = 0u64;
    let mut shift = 0;
    loop {
        let byte = *bytes.get(*pos)?;
        *pos += 1;
        n |= u64::from(byte & 0x7f) << shift;
        if byte & 0x80 == 0 { return Some(n); }
        shift += 7;
        if shift > 63 { return None; }
    }
}

fn zigzag(n: i64) -> u64 { ((n << 1) ^ (n >> 63)) as u64 }

fn unzigzag(n: u64) -> i64 { ((n >> 1) as i64) ^ -((n & 1) as i64) }

pub fn encode_edges(stop_pk: i64, edges: &[CoarseEdge]) -> Vec<u8> {
    let mut out = Vec::with_capacity(edges.len() * 6);
    let mut previous = stop_pk;
    for e in edges {
        let kind = match e.kind { EdgeKind::Transit => 0, EdgeKind::Walk => WALK };
        put_varint(&mut out, zigzag(e.to.wrapping_sub(previous)) << 1 | kind);
        previous = e.to;
        match e.kind {
            EdgeKind::Transit => put_varint(&mut out, match e.via_pattern { Some(p) if p >= 0 => p as u64 + 1, _ => 0 }),
            EdgeKind::Walk => out.extend_from_slice(&e.distance_m.to_le_bytes()),
        }
    }
    out
}

/// None means the blob is cut short or malformed.
pub fn decode_edges(stop_pk: i64, bytes: &[u8]) -> Option<Vec<CoarseEdge>> {
    let mut out = Vec::new();
    let mut pos = 0;
    let mut previous = stop_pk;
    while pos < bytes.len() {
        let head = read_varint(bytes, &mut pos)?;
        let to = previous.wrapping_add(unzigzag(head >> 1));
        previous = to;
        out.push(if head & 1 == WALK {
            let raw = bytes.get(pos..pos + 8)?;
            pos += 8;
            CoarseEdge { to, kind: EdgeKind::Walk, cost: 0.5, distance_m: f64::from_le_bytes(raw.try_into().ok()?), via_pattern: None }
        } else {
            let via = read_varint(bytes, &mut pos)?;
            CoarseEdge { to, kind: EdgeKind::Transit, cost: 1.0, distance_m: 0.0, via_pattern: via.checked_sub(1).map(|p| p as i64) }
        });
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use crate::graph::coarse::build_adjacency_from_scratch;
    use crate::repo::{PatternCumulativeCache, PatternStopRow, PatternsCache, StopRow, StopsCache};

    fn same(a: &CoarseEdge, b: &CoarseEdge) -> bool {
        a.to == b.to && a.kind == b.kind && a.cost.to_bits() == b.cost.to_bits()
            && a.distance_m.to_bits() == b.distance_m.to_bits() && a.via_pattern == b.via_pattern
    }

    fn stop(pk: i64, lat: f64) -> StopRow {
        StopRow { stop_pk: pk, stop_id: pk.to_string(), stop_name: format!("s{pk}"), stop_lat: lat, stop_lon: 144.0, agency: 1 }
    }

    fn row(pattern_pk: i64, stop_pk: i64, seq: i64) -> PatternStopRow {
        PatternStopRow { pattern_pk, stop_pk, stop_sequence: seq }
    }

    /// Six stops 1.1 km apart (walk edges), two lines in opposite directions, and a 70-stop line that is stride sampled.
    fn built_graph() -> HashMap<i64, Vec<CoarseEdge>> {
        let mut stops: Vec<StopRow> = (1..=6).map(|pk| stop(pk, -37.0 - 0.01 * pk as f64)).collect();
        stops.extend((100..170).map(|pk| stop(pk, -36.0 - 0.05 * pk as f64)));
        let mut rows = vec![row(10, 1, 1), row(10, 2, 2), row(10, 3, 3), row(10, 4, 4)];
        rows.extend([row(11, 4, 1), row(11, 2, 2), row(11, 1, 3)]);
        rows.extend((100..170).map(|pk| row(12, pk, pk - 99)));
        let patterns = PatternsCache::for_test(vec![(10, Some(0)), (11, Some(1)), (12, Some(2))]);
        let cumulative_rows = rows.iter().map(|r| ((r.pattern_pk, r.stop_pk), r.stop_sequence * 100)).collect();
        let cumulative = PatternCumulativeCache::from_rows_for_test(cumulative_rows);
        build_adjacency_from_scratch(&StopsCache::for_test(stops), &rows, &patterns, &cumulative)
    }

    #[test]
    fn a_built_graph_decodes_to_the_same_edges() {
        let adjacency = built_graph();
        let kinds: Vec<EdgeKind> = adjacency.values().flatten().map(|e| e.kind).collect();
        assert!(kinds.contains(&EdgeKind::Transit) && kinds.contains(&EdgeKind::Walk));
        for (&stop_pk, edges) in &adjacency {
            let decoded = decode_edges(stop_pk, &encode_edges(stop_pk, edges)).expect("decodes");
            assert_eq!(decoded.len(), edges.len());
            assert!(edges.iter().zip(&decoded).all(|(a, b)| same(a, b)), "stop {stop_pk} changed");
        }
    }

    #[test]
    fn extreme_values_survive() {
        let edge = |to, kind, distance_m, via_pattern| {
            let cost = if kind == EdgeKind::Transit { 1.0 } else { 0.5 };
            CoarseEdge { to, kind, cost, distance_m, via_pattern }
        };
        let edges = vec![
            edge(1, EdgeKind::Walk, 1234.567_890_123_4, None),
            edge(4_000_000_000, EdgeKind::Transit, 0.0, Some(0)),
            edge(0, EdgeKind::Walk, 0.0, None),
            edge(29_497, EdgeKind::Transit, 0.0, Some(4_599)),
            edge(29_497, EdgeKind::Walk, 2_500.0, None),
            edge(2, EdgeKind::Walk, -0.0, None),
        ];
        let decoded = decode_edges(30_000, &encode_edges(30_000, &edges)).expect("decodes");
        assert!(edges.iter().zip(&decoded).all(|(a, b)| same(a, b)));
    }

    #[test]
    fn an_empty_list_round_trips_and_a_cut_blob_is_rejected() {
        assert!(decode_edges(7, &[]).expect("empty is valid").is_empty());
        let walk = CoarseEdge { to: 9, kind: EdgeKind::Walk, cost: 0.5, distance_m: 100.0, via_pattern: None };
        let blob = encode_edges(7, &[walk]);
        assert!(decode_edges(7, &blob[..blob.len() - 1]).is_none());
    }

    #[test]
    fn the_blob_is_less_than_half_the_old_25_byte_record() {
        let adjacency = built_graph();
        let edges: usize = adjacency.values().map(Vec::len).sum();
        let bytes: usize = adjacency.iter().map(|(&pk, e)| encode_edges(pk, e).len()).sum();
        assert!(bytes * 2 < edges * 25, "{bytes} bytes for {edges} edges");
    }
}
