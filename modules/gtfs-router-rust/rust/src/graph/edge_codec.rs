//! graph/edge_codec.rs — packs one stop's coarse edges into a small blob and back.
//!
//! Per edge: varint(zigzag(to - previous_to) << 1 | kind), then for a transit edge
//! varint(via_pattern + 1) with 0 meaning none. A walk edge stores nothing more.
//! `previous_to` starts at the stop's own pk, so neighbours with nearby pks cost 1 to 3 bytes.
//! Transit edges always carry distance 0.0 and walk edges never carry a pattern (see coarse.rs),
//! so those fields are not stored. A walk edge's distance is recomputed from the two stops on
//! decode with the same function the build uses. Edge order is kept, because search tie-breaking
//! follows it.

use crate::graph::coarse::{pair_distance_m, CoarseEdge, EdgeKind};
use crate::repo::StopsCache;
use crate::varint::{put_varint, read_varint, unzigzag, zigzag};

const WALK: u64 = 1;

pub fn encode_edges(stop_pk: i64, edges: &[CoarseEdge]) -> Vec<u8> {
    let mut out = Vec::with_capacity(edges.len() * 3);
    let mut previous = stop_pk;
    for e in edges {
        let kind = match e.kind { EdgeKind::Transit => 0, EdgeKind::Walk => WALK };
        put_varint(&mut out, zigzag(e.to.wrapping_sub(previous)) << 1 | kind);
        previous = e.to;
        match e.kind {
            EdgeKind::Transit => put_varint(&mut out, match e.via_pattern { Some(p) if p >= 0 => p as u64 + 1, _ => 0 }),
            EdgeKind::Walk => {}
        }
    }
    out
}

/// None means the blob is cut short or malformed, or names a stop that is not in `stops`.
pub fn decode_edges(stop_pk: i64, bytes: &[u8], stops: &StopsCache) -> Option<Vec<CoarseEdge>> {
    let mut out = Vec::new();
    let mut pos = 0;
    let mut previous = stop_pk;
    let from = stops.get(stop_pk);
    while pos < bytes.len() {
        let head = read_varint(bytes, &mut pos)?;
        let to = previous.wrapping_add(unzigzag(head >> 1));
        previous = to;
        out.push(if head & 1 == WALK {
            let distance_m = pair_distance_m(from?, stops.get(to)?);
            CoarseEdge { to, kind: EdgeKind::Walk, cost: 0.5, distance_m, via_pattern: None }
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
    use crate::geo::{haversine_meters, LatLon};
    use crate::graph::coarse::build_adjacency_from_scratch;
    use crate::repo::{PatternCumulativeCache, PatternStopRow, PatternsCache, StopRow};

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
    fn built_graph() -> (StopsCache, HashMap<i64, Vec<CoarseEdge>>) {
        let mut stop_rows: Vec<StopRow> = (1..=6).map(|pk| stop(pk, -37.0 - 0.01 * pk as f64)).collect();
        stop_rows.extend((100..170).map(|pk| stop(pk, -36.0 - 0.05 * pk as f64)));
        let stops = StopsCache::for_test(stop_rows);
        let mut rows = vec![row(10, 1, 1), row(10, 2, 2), row(10, 3, 3), row(10, 4, 4)];
        rows.extend([row(11, 4, 1), row(11, 2, 2), row(11, 1, 3)]);
        rows.extend((100..170).map(|pk| row(12, pk, pk - 99)));
        let patterns = PatternsCache::for_test(vec![(10, Some(0)), (11, Some(1)), (12, Some(2))]);
        let cumulative_rows = rows.iter().map(|r| ((r.pattern_pk, r.stop_pk), r.stop_sequence * 100)).collect();
        let cumulative = PatternCumulativeCache::from_rows_for_test(cumulative_rows);
        let adjacency = build_adjacency_from_scratch(&stops, &rows, &patterns, &cumulative);
        (stops, adjacency)
    }

    #[test]
    fn a_built_graph_decodes_to_the_same_edges() {
        let (stops, adjacency) = built_graph();
        let kinds: Vec<EdgeKind> = adjacency.values().flatten().map(|e| e.kind).collect();
        assert!(kinds.contains(&EdgeKind::Transit) && kinds.contains(&EdgeKind::Walk));
        for (&stop_pk, edges) in &adjacency {
            let decoded = decode_edges(stop_pk, &encode_edges(stop_pk, edges), &stops).expect("decodes");
            assert_eq!(decoded.len(), edges.len());
            assert!(edges.iter().zip(&decoded).all(|(a, b)| same(a, b)), "stop {stop_pk} changed");
        }
    }

    #[test]
    fn a_walk_distance_is_the_lower_pk_first_haversine_in_both_directions() {
        let (stops, adjacency) = built_graph();
        let walks: Vec<(i64, &CoarseEdge)> = adjacency.iter()
            .flat_map(|(&from, edges)| edges.iter().map(move |e| (from, e)))
            .filter(|(_, e)| e.kind == EdgeKind::Walk)
            .collect();
        assert!(!walks.is_empty());
        for (from, e) in walks {
            let (lo, hi) = (stops.get(from.min(e.to)).unwrap(), stops.get(from.max(e.to)).unwrap());
            let expected = haversine_meters(LatLon { lat: lo.stop_lat, lon: lo.stop_lon }, LatLon { lat: hi.stop_lat, lon: hi.stop_lon });
            let decoded = decode_edges(from, &encode_edges(from, std::slice::from_ref(e)), &stops).expect("decodes");
            assert_eq!(decoded[0].distance_m.to_bits(), expected.to_bits(), "{from} -> {}", e.to);
        }
    }

    #[test]
    fn extreme_values_survive() {
        let stops = StopsCache::for_test(vec![stop(1, -37.0), stop(2, -37.001), stop(29_497, -37.5), stop(30_000, -37.6)]);
        let from = stops.get(30_000).unwrap();
        let walk = |to: i64| CoarseEdge {
            to, kind: EdgeKind::Walk, cost: 0.5, distance_m: pair_distance_m(from, stops.get(to).unwrap()), via_pattern: None,
        };
        let transit = |to: i64, via_pattern| CoarseEdge { to, kind: EdgeKind::Transit, cost: 1.0, distance_m: 0.0, via_pattern };
        let edges = vec![
            walk(1),
            transit(4_000_000_000, Some(0)),
            transit(0, None),
            transit(29_497, Some(4_599)),
            walk(29_497),
            walk(2),
        ];
        let decoded = decode_edges(30_000, &encode_edges(30_000, &edges), &stops).expect("decodes");
        assert_eq!(decoded.len(), edges.len());
        assert!(edges.iter().zip(&decoded).all(|(a, b)| same(a, b)));
    }

    #[test]
    fn an_empty_list_round_trips_and_a_cut_blob_is_rejected() {
        let stops = StopsCache::for_test(vec![stop(7, -37.0)]);
        assert!(decode_edges(7, &[], &stops).expect("empty is valid").is_empty());
        let transit = CoarseEdge { to: 9, kind: EdgeKind::Transit, cost: 1.0, distance_m: 0.0, via_pattern: Some(4_599) };
        let blob = encode_edges(7, &[transit]);
        assert!(decode_edges(7, &blob[..blob.len() - 1], &stops).is_none());
    }

    #[test]
    fn a_walk_edge_to_an_unknown_stop_is_rejected() {
        let stops = StopsCache::for_test(vec![stop(7, -37.0)]);
        let walk = CoarseEdge { to: 9, kind: EdgeKind::Walk, cost: 0.5, distance_m: 100.0, via_pattern: None };
        assert!(decode_edges(7, &encode_edges(7, &[walk]), &stops).is_none());
    }

    #[test]
    fn the_blob_averages_under_four_bytes_an_edge() {
        let (_, adjacency) = built_graph();
        let edges: usize = adjacency.values().map(Vec::len).sum();
        let bytes: usize = adjacency.iter().map(|(&pk, e)| encode_edges(pk, e).len()).sum();
        assert!(bytes < edges * 4, "{bytes} bytes for {edges} edges");
    }
}
