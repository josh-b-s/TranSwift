import { type BlobBytes, toBytes, VarintReader } from './varint';

/**
 * Reads `shapes.points`: per point varint(zigzag(lat - previous lat)) then the same for lon, the first point measured
 * from (0, 0). Coordinates are degrees * 1e6. The importer's and router's shape_codec.rs test against the same bytes.
 */
export function decodeShape(blob: BlobBytes): { lat: number; lon: number }[] {
    const reader = new VarintReader(toBytes(blob));
    const out: { lat: number; lon: number }[] = [];
    let lat = 0;
    let lon = 0;
    while (!reader.done) {
        lat += reader.signed();
        lon += reader.signed();
        out.push({ lat, lon });
    }
    return out;
}
