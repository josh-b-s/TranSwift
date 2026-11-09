//! shape_codec.rs — packs one shape's points into the blob stored in `shapes.points`.
//!
//! Per point: varint(zigzag(lat - previous_lat)) then varint(zigzag(lon - previous_lon)), the first point
//! measured from (0, 0). Coordinates are the scaled integers stops.stop_lat uses (degrees * 1e6). Points are
//! stored in sequence order and the sequence numbers themselves are dropped.
//! The router crate's shape_codec.rs and services/gtfs/core/shapeCodec.ts read this format, and all three
//! test against the same bytes (SHAPE_GOLDEN) so a change to one cannot slip past the others.

use crate::varint::{put_varint, zigzag};

pub fn encode_shape(points: &[(i64, i64)]) -> Vec<u8> {
    let mut out = Vec::with_capacity(points.len() * 4);
    let (mut lat, mut lon) = (0i64, 0i64);
    for &(next_lat, next_lon) in points {
        put_varint(&mut out, zigzag(next_lat - lat));
        put_varint(&mut out, zigzag(next_lon - lon));
        (lat, lon) = (next_lat, next_lon);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::varint::{read_varint, unzigzag};

    /// Made by an independent Python encoder, and pinned in the router's and the app's tests as well.
    const SHAPE_GOLDEN: &str = "9fbd872480a89f8a018f4e904e8f4e904e14cf0f";
    const SHAPE: [(i64, i64); 4] = [(-37_810_000, 144_960_000), (-37_815_000, 144_965_000), (-37_820_000, 144_970_000), (-37_819_990, 144_969_000)];

    fn hex(bytes: &[u8]) -> String { bytes.iter().map(|b| format!("{b:02x}")).collect() }

    fn decode(bytes: &[u8]) -> Vec<(i64, i64)> {
        let (mut pos, mut lat, mut lon, mut out) = (0, 0i64, 0i64, Vec::new());
        while pos < bytes.len() {
            lat += unzigzag(read_varint(bytes, &mut pos).unwrap());
            lon += unzigzag(read_varint(bytes, &mut pos).unwrap());
            out.push((lat, lon));
        }
        out
    }

    #[test]
    fn the_encoding_matches_the_shared_golden_bytes() {
        assert_eq!(hex(&encode_shape(&SHAPE)), SHAPE_GOLDEN);
    }

    #[test]
    fn points_round_trip_including_backwards_and_extreme_steps() {
        let points = vec![(0, 0), (1, -1), (-90_000_000, 180_000_000), (90_000_000, -180_000_000), (90_000_000, -180_000_000), (7, 7)];
        assert_eq!(decode(&encode_shape(&points)), points);
        assert!(encode_shape(&[]).is_empty());
    }

    #[test]
    fn a_dense_shape_costs_a_few_bytes_a_point() {
        let points: Vec<(i64, i64)> = (0..1000).map(|i| (-37_810_000 - i * 90, 144_960_000 + i * 60)).collect();
        let bytes = encode_shape(&points).len();
        assert!(bytes < points.len() * 4, "{bytes} bytes for {} points", points.len());
    }
}
