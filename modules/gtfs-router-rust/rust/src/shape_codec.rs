//! shape_codec.rs — reads the blob in `shapes.points` that the importer's shape_codec.rs writes.
//!
//! Per point: varint(zigzag(lat - previous_lat)) then varint(zigzag(lon - previous_lon)), the first point
//! measured from (0, 0). Coordinates are scaled integers (degrees * 1e6). The importer's shape_codec.rs and
//! services/gtfs/core/shapeCodec.ts test against the same bytes (SHAPE_GOLDEN).

use crate::varint::{read_varint, unzigzag};

/// None means the blob is cut short.
pub fn decode_shape(bytes: &[u8]) -> Option<Vec<(i64, i64)>> {
    let (mut pos, mut lat, mut lon) = (0, 0i64, 0i64);
    let mut out = Vec::with_capacity(bytes.len() / 4);
    while pos < bytes.len() {
        lat = lat.wrapping_add(unzigzag(read_varint(bytes, &mut pos)?));
        lon = lon.wrapping_add(unzigzag(read_varint(bytes, &mut pos)?));
        out.push((lat, lon));
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Made by an independent Python encoder, and pinned in the importer's and the app's tests as well.
    const SHAPE_GOLDEN: &str = "9fbd872480a89f8a018f4e904e8f4e904e14cf0f";

    fn unhex(s: &str) -> Vec<u8> { (0..s.len()).step_by(2).map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap()).collect() }

    #[test]
    fn the_shared_golden_bytes_decode_to_the_original_points() {
        assert_eq!(
            decode_shape(&unhex(SHAPE_GOLDEN)),
            Some(vec![(-37_810_000, 144_960_000), (-37_815_000, 144_965_000), (-37_820_000, 144_970_000), (-37_819_990, 144_969_000)]),
        );
    }

    #[test]
    fn an_empty_blob_is_an_empty_shape_and_a_cut_blob_is_rejected() {
        assert_eq!(decode_shape(&[]), Some(vec![]));
        let bytes = unhex(SHAPE_GOLDEN);
        assert_eq!(decode_shape(&bytes[..bytes.len() - 1]), None);
        // The last point is 3 bytes (lat delta, then a 2-byte lon delta); cutting between its lat and lon is also rejected.
        assert_eq!(decode_shape(&bytes[..bytes.len() - 2]), None);
        assert_eq!(decode_shape(&bytes[..bytes.len() - 3]).map(|p| p.len()), Some(3));
    }
}
