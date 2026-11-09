import { type BlobBytes, toBytes, VarintReader } from './varint';

export type StopTimeCall = {
    departureSec: number;
    tripPk: number;
    stopSequence: number;
    dwellSec: number;
    pickupType: number;
    dropOffType: number;
};

/**
 * Reads one `stop_time_chunks.data` blob: a stop's calls sorted by (departure, trip, sequence), each as a change from
 * the one before, starting at (first_dep, trip 0, sequence 0). Per call:
 *   varint(departure delta << 2 | has_extra << 1 | sequence_changed), varint(zigzag(trip delta)),
 *   [varint(zigzag(sequence delta))] if sequence_changed, [dwell, pickup, drop_off as zigzag varints] if has_extra.
 * The importer's and router's stop_time_codec.rs test against the same bytes.
 */
export function decodeChunk(firstDeparture: number, blob: BlobBytes): StopTimeCall[] {
    const reader = new VarintReader(toBytes(blob));
    const out: StopTimeCall[] = [];
    let departureSec = firstDeparture;
    let tripPk = 0;
    let stopSequence = 0;
    while (!reader.done) {
        const head = reader.unsigned();
        // head is a plain number, so the flags are taken with arithmetic: bitwise operators would cut it to 32 bits.
        departureSec += Math.floor(head / 4);
        tripPk += reader.signed();
        if (head % 2 === 1) stopSequence += reader.signed();
        const hasExtra = Math.floor(head / 2) % 2 === 1;
        out.push({
            departureSec, tripPk, stopSequence,
            dwellSec: hasExtra ? reader.signed() : 0,
            pickupType: hasExtra ? reader.signed() : 0,
            dropOffType: hasExtra ? reader.signed() : 0,
        });
    }
    return out;
}
