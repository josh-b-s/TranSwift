//! stop_time_codec.rs — reads the chunks in `stop_time_chunks.data` that the importer's stop_time_codec.rs writes.
//!
//! A chunk holds one stop's calls, sorted by (departure_sec, trip_pk, stop_sequence), each as a change from
//! the one before it, starting at (departure = first_dep, trip_pk = 0, stop_sequence = 0):
//!
//!   varint(departure_delta << 2 | has_extra << 1 | sequence_changed)
//!   varint(zigzag(trip_pk - previous_trip_pk))
//!   if sequence_changed: varint(zigzag(stop_sequence - previous_stop_sequence))
//!   if has_extra:        varint(zigzag(dwell_sec)), varint(zigzag(pickup_type)), varint(zigzag(drop_off_type))
//!
//! The importer's stop_time_codec.rs and services/gtfs/core/stopTimeCodec.ts test against the same bytes
//! (CHUNK_GOLDEN).

use crate::varint::{read_varint, unzigzag};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StopTimeRow {
    pub departure_sec: i64,
    pub trip_pk: i64,
    pub stop_sequence: i64,
    pub dwell_sec: i64,
    pub pickup_type: i64,
    pub drop_off_type: i64,
}

/// None means the chunk is cut short.
pub fn decode_chunk(first_departure: i64, bytes: &[u8]) -> Option<Vec<StopTimeRow>> {
    let (mut pos, mut departure, mut trip_pk, mut sequence) = (0, first_departure, 0i64, 0i64);
    let mut out = Vec::with_capacity(bytes.len() / 3);
    while pos < bytes.len() {
        let head = read_varint(bytes, &mut pos)?;
        departure = departure.wrapping_add((head >> 2) as i64);
        trip_pk = trip_pk.wrapping_add(unzigzag(read_varint(bytes, &mut pos)?));
        if head & 1 == 1 { sequence = sequence.wrapping_add(unzigzag(read_varint(bytes, &mut pos)?)); }
        let (mut dwell_sec, mut pickup_type, mut drop_off_type) = (0, 0, 0);
        if head & 2 == 2 {
            dwell_sec = unzigzag(read_varint(bytes, &mut pos)?);
            pickup_type = unzigzag(read_varint(bytes, &mut pos)?);
            drop_off_type = unzigzag(read_varint(bytes, &mut pos)?);
        }
        out.push(StopTimeRow { departure_sec: departure, trip_pk, stop_sequence: sequence, dwell_sec, pickup_type, drop_off_type });
    }
    Some(out)
}

/// The importer's encoder, copied for tests that build a table to read back (see the importer's stop_time_codec.rs).
#[cfg(test)]
pub fn encode_chunk(first_departure: i64, rows: &[StopTimeRow]) -> Vec<u8> {
    use crate::varint::{put_varint, zigzag};
    let mut out = Vec::new();
    let (mut departure, mut trip_pk, mut sequence) = (first_departure, 0i64, 0i64);
    for row in rows {
        let has_extra = row.dwell_sec != 0 || row.pickup_type != 0 || row.drop_off_type != 0;
        let sequence_changed = row.stop_sequence != sequence;
        put_varint(&mut out, ((row.departure_sec - departure) as u64) << 2 | u64::from(has_extra) << 1 | u64::from(sequence_changed));
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

    /// Made by an independent Python encoder, and pinned in the importer's and the app's tests as well.
    const CHUNK_GOLDEN: &str = "01c801020002b3090202780000e3121701000206f3e827ccabe204d604090000";

    fn unhex(s: &str) -> Vec<u8> { (0..s.len()).step_by(2).map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap()).collect() }

    fn row(departure_sec: i64, trip_pk: i64, stop_sequence: i64, dwell_sec: i64, pickup_type: i64, drop_off_type: i64) -> StopTimeRow {
        StopTimeRow { departure_sec, trip_pk, stop_sequence, dwell_sec, pickup_type, drop_off_type }
    }

    #[test]
    fn the_shared_golden_bytes_decode_to_the_original_rows() {
        assert_eq!(decode_chunk(36_000, &unhex(CHUNK_GOLDEN)), Some(vec![
            row(36_000, 100, 1, 0, 0, 0),
            row(36_000, 101, 1, 0, 0, 0),
            row(36_300, 102, 2, 60, 0, 0),
            row(36_900, 90, 1, 0, 1, 3),
            row(200_000, 5_000_000, 300, -5, 0, 0),
        ]));
    }

    #[test]
    fn an_empty_chunk_is_empty_and_a_cut_chunk_is_rejected() {
        assert_eq!(decode_chunk(0, &[]), Some(vec![]));
        let bytes = unhex(CHUNK_GOLDEN);
        for cut in 1..bytes.len() {
            // Every prefix either stops on a row boundary or is rejected; none may panic.
            if let Some(rows) = decode_chunk(36_000, &bytes[..cut]) { assert!(rows.len() < 5); }
        }
        assert_eq!(decode_chunk(36_000, &bytes[..bytes.len() - 1]), None);
    }
}
