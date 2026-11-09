import type Database from 'better-sqlite3';
import type { StopTimeCall } from '@/services/gtfs/core/stopTimeCodec';

// Encoders for building test databases; the app only reads these blobs. They follow the importer's stop_time_codec.rs
// and shape_codec.rs, and the golden tests check them against the bytes those write.

function varint(out: number[], n: number) {
    while (n >= 0x80) {
        out.push((n % 0x80) | 0x80);
        n = Math.floor(n / 0x80);
    }
    out.push(n);
}

const zigzag = (n: number) => (n >= 0 ? n * 2 : -n * 2 - 1);

export function encodeShape(points: { lat: number; lon: number }[]): Uint8Array {
    const out: number[] = [];
    let lat = 0;
    let lon = 0;
    for (const p of points) {
        varint(out, zigzag(p.lat - lat));
        varint(out, zigzag(p.lon - lon));
        ({ lat, lon } = p);
    }
    return Uint8Array.from(out);
}

export function encodeChunk(firstDeparture: number, calls: StopTimeCall[]): Uint8Array {
    const out: number[] = [];
    let departure = firstDeparture;
    let tripPk = 0;
    let sequence = 0;
    for (const c of calls) {
        const hasExtra = c.dwellSec !== 0 || c.pickupType !== 0 || c.dropOffType !== 0;
        const sequenceChanged = c.stopSequence !== sequence;
        varint(out, (c.departureSec - departure) * 4 + (hasExtra ? 2 : 0) + (sequenceChanged ? 1 : 0));
        varint(out, zigzag(c.tripPk - tripPk));
        if (sequenceChanged) varint(out, zigzag(c.stopSequence - sequence));
        if (hasExtra) [c.dwellSec, c.pickupType, c.dropOffType].forEach(v => varint(out, zigzag(v)));
        ({ departureSec: departure, tripPk, stopSequence: sequence } = c);
    }
    return Uint8Array.from(out);
}

export const call = (departureSec: number, tripPk: number, stopSequence: number, dwellSec = 0): StopTimeCall =>
    ({ departureSec, tripPk, stopSequence, dwellSec, pickupType: 0, dropOffType: 0 });

/** Stores a stop's calls as chunks of `rowsPerChunk`, sorted the way the importer sorts them. */
export function addStopCalls(sqlite: Database.Database, stopPk: number, calls: StopTimeCall[], rowsPerChunk = 1) {
    const sorted = [...calls].sort((a, b) => a.departureSec - b.departureSec || a.tripPk - b.tripPk || a.stopSequence - b.stopSequence);
    const insert = sqlite.prepare(`INSERT INTO stop_time_chunks (stop_pk, first_dep, chunk_idx, data) VALUES (?, ?, ?, ?)`);
    const nextIdx = sqlite.prepare(`SELECT COUNT(*) AS n FROM stop_time_chunks WHERE stop_pk = ? AND first_dep = ?`);
    for (let i = 0; i < sorted.length; i += rowsPerChunk) {
        const chunk = sorted.slice(i, i + rowsPerChunk);
        const first = chunk[0].departureSec;
        const { n } = nextIdx.get(stopPk, first) as { n: number };
        insert.run(stopPk, first, n, Buffer.from(encodeChunk(first, chunk)));
    }
}

export function addShape(sqlite: Database.Database, shapePk: number, points: { lat: number; lon: number }[]) {
    sqlite.prepare(`INSERT INTO shapes (shape_pk, points) VALUES (?, ?)`).run(shapePk, Buffer.from(encodeShape(points)));
}
