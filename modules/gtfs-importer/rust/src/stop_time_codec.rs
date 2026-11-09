//! stop_time_codec.rs — packs the departures at one stop into the blobs stored in `stop_time_chunks.data`.
//!
//! A stop's rows are sorted by (departure_sec, trip_pk, stop_sequence) and cut into chunks of CHUNK_ROWS. The
//! chunk's key holds its first departure; the blob holds each row as a change from the one before it, which
//! starts at (departure = first_departure, trip_pk = 0, stop_sequence = 0):
//!
//!   varint(departure_delta << 2 | has_extra << 1 | sequence_changed)
//!   varint(zigzag(trip_pk - previous_trip_pk))
//!   if sequence_changed: varint(zigzag(stop_sequence - previous_stop_sequence))
//!   if has_extra:        varint(zigzag(dwell_sec)), varint(zigzag(pickup_type)), varint(zigzag(drop_off_type))
//!
//! Extras are present only when one of the three is not 0, which is a small share of rows. Rows of one pattern
//! usually keep the same sequence at a stop, so most rows cost only the first two varints.
//! The router crate's stop_time_codec.rs and services/gtfs/core/stopTimeCodec.ts read this format, and all
//! three test against the same bytes (CHUNK_GOLDEN) so a change to one cannot slip past the others.

use crate::varint::{put_varint, zigzag};

/// Rows per chunk. A search decodes whole chunks, so this trades per-chunk overhead against decoding rows it
/// then discards. At about 4 bytes a row a chunk is near 250 bytes, well inside a 4 KiB page.
pub const CHUNK_ROWS: usize = 64;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StopTimeRow {
    pub departure_sec: i64,
    pub trip_pk: i64,
    pub stop_sequence: i64,
    pub dwell_sec: i64,
    pub pickup_type: i64,
    pub drop_off_type: i64,
}

/// `rows` must be sorted by (departure_sec, trip_pk, stop_sequence) and `first_departure` is the first row's.
pub fn encode_chunk<'a>(first_departure: i64, rows: impl IntoIterator<Item = &'a StopTimeRow>) -> Vec<u8> {
    let rows = rows.into_iter();
    let mut out = Vec::with_capacity(rows.size_hint().0 * 4);
    let (mut departure, mut trip_pk, mut sequence) = (first_departure, 0i64, 0i64);
    for row in rows {
        let delta = u64::try_from(row.departure_sec - departure).expect("rows are sorted by departure");
        let has_extra = row.dwell_sec != 0 || row.pickup_type != 0 || row.drop_off_type != 0;
        let sequence_changed = row.stop_sequence != sequence;
        put_varint(&mut out, delta << 2 | u64::from(has_extra) << 1 | u64::from(sequence_changed));
        put_varint(&mut out, zigzag(row.trip_pk - trip_pk));
        if sequence_changed { put_varint(&mut out, zigzag(row.stop_sequence - sequence)); }
        if has_extra {
            put_varint(&mut out, zigzag(row.dwell_sec));
            put_varint(&mut out, zigzag(row.pickup_type));
            put_varint(&mut out, zigzag(row.drop_off_type));
        }
        (departure, trip_pk, sequence) = (row.departure_sec, row.trip_pk, row.stop_sequence);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::varint::{read_varint, unzigzag};

    /// Made by an independent Python encoder, and pinned in the router's and the app's tests as well.
    const CHUNK_GOLDEN: &str = "01c801020002b3090202780000e3121701000206f3e827ccabe204d604090000";

    fn row(departure_sec: i64, trip_pk: i64, stop_sequence: i64, dwell_sec: i64, pickup_type: i64, drop_off_type: i64) -> StopTimeRow {
        StopTimeRow { departure_sec, trip_pk, stop_sequence, dwell_sec, pickup_type, drop_off_type }
    }

    fn golden_rows() -> Vec<StopTimeRow> {
        vec![row(36_000, 100, 1, 0, 0, 0), row(36_000, 101, 1, 0, 0, 0), row(36_300, 102, 2, 60, 0, 0), row(36_900, 90, 1, 0, 1, 3), row(200_000, 5_000_000, 300, -5, 0, 0)]
    }

    fn hex(bytes: &[u8]) -> String { bytes.iter().map(|b| format!("{b:02x}")).collect() }

    fn decode(first_departure: i64, bytes: &[u8]) -> Vec<StopTimeRow> {
        let (mut pos, mut departure, mut trip_pk, mut sequence, mut out) = (0, first_departure, 0i64, 0i64, Vec::new());
        while pos < bytes.len() {
            let head = read_varint(bytes, &mut pos).unwrap();
            departure += (head >> 2) as i64;
            trip_pk += unzigzag(read_varint(bytes, &mut pos).unwrap());
            if head & 1 == 1 { sequence += unzigzag(read_varint(bytes, &mut pos).unwrap()); }
            let (mut dwell, mut pickup, mut drop_off) = (0, 0, 0);
            if head & 2 == 2 {
                dwell = unzigzag(read_varint(bytes, &mut pos).unwrap());
                pickup = unzigzag(read_varint(bytes, &mut pos).unwrap());
                drop_off = unzigzag(read_varint(bytes, &mut pos).unwrap());
            }
            out.push(row(departure, trip_pk, sequence, dwell, pickup, drop_off));
        }
        out
    }

    #[test]
    fn the_encoding_matches_the_shared_golden_bytes() {
        assert_eq!(hex(&encode_chunk(36_000, &golden_rows())), CHUNK_GOLDEN);
    }

    #[test]
    fn rows_round_trip() {
        let rows = golden_rows();
        assert_eq!(decode(36_000, &encode_chunk(36_000, &rows)), rows);
    }

    #[test]
    fn a_stop_with_a_hundred_thousand_varied_rows_round_trips_chunk_by_chunk() {
        // A small deterministic generator, so the test needs no extra crate.
        let mut state = 12_345u64;
        let mut next = |bound: u64| { state = state.wrapping_mul(6_364_136_223_846_793_005).wrapping_add(1_442_695_040_888_963_407); (state >> 33) % bound };
        let mut rows: Vec<StopTimeRow> = (0..100_000)
            .map(|_| row(next(100_000) as i64, next(400_000) as i64 + 1, next(60) as i64 + 1, if next(50) == 0 { next(120) as i64 - 20 } else { 0 }, if next(60) == 0 { next(4) as i64 } else { 0 }, if next(60) == 0 { next(4) as i64 } else { 0 }))
            .collect();
        rows.sort_by_key(|r| (r.departure_sec, r.trip_pk, r.stop_sequence));
        for chunk in rows.chunks(CHUNK_ROWS) {
            let first = chunk[0].departure_sec;
            assert_eq!(decode(first, &encode_chunk(first, chunk)), chunk);
        }
    }

    #[test]
    fn a_busy_stop_costs_a_few_bytes_a_row() {
        // Two routes alternating every 90 seconds, trips numbered in time order within each route.
        let rows: Vec<StopTimeRow> = (0..CHUNK_ROWS as i64).map(|i| row(30_000 + i * 90, 1_000 + (i / 2) + (i % 2) * 5_000, if i % 2 == 0 { 7 } else { 12 }, 0, 0, 0)).collect();
        let bytes = encode_chunk(30_000, &rows).len();
        assert!(bytes < rows.len() * 5, "{bytes} bytes for {} rows", rows.len());
    }

    #[test]
    #[should_panic(expected = "sorted")]
    fn unsorted_rows_are_refused() {
        encode_chunk(100, &[row(100, 1, 1, 0, 0, 0), row(99, 2, 1, 0, 0, 0)]);
    }
}
