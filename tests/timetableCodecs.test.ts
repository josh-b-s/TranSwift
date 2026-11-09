import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeShape } from '@/services/gtfs/core/shapeCodec';
import { decodeChunk } from '@/services/gtfs/core/stopTimeCodec';
import { call, encodeChunk, encodeShape } from './timetableFixtures';

// The same bytes the importer's and router's Rust tests pin, made by an independent Python encoder.
const SHAPE_GOLDEN = '9fbd872480a89f8a018f4e904e8f4e904e14cf0f';
const CHUNK_GOLDEN = '01c801020002b3090202780000e3121701000206f3e827ccabe204d604090000';

const unhex = (s: string) => Uint8Array.from(s.match(/../g)!.map(h => parseInt(h, 16)));
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

const SHAPE = [
    { lat: -37_810_000, lon: 144_960_000 }, { lat: -37_815_000, lon: 144_965_000 },
    { lat: -37_820_000, lon: 144_970_000 }, { lat: -37_819_990, lon: 144_969_000 },
];
const CALLS = [
    call(36_000, 100, 1), call(36_000, 101, 1), call(36_300, 102, 2, 60),
    { ...call(36_900, 90, 1), pickupType: 1, dropOffType: 3 },
    call(200_000, 5_000_000, 300, -5),
];

test('the shape golden bytes decode to the original points and the test encoder reproduces them', () => {
    assert.deepEqual(decodeShape(unhex(SHAPE_GOLDEN)), SHAPE);
    assert.equal(hex(encodeShape(SHAPE)), SHAPE_GOLDEN);
});

test('the chunk golden bytes decode to the original calls and the test encoder reproduces them', () => {
    assert.deepEqual(decodeChunk(36_000, unhex(CHUNK_GOLDEN)), CALLS);
    assert.equal(hex(encodeChunk(36_000, CALLS)), CHUNK_GOLDEN);
});

test('an ArrayBuffer decodes like a Buffer, since the app driver returns one', () => {
    const bytes = unhex(SHAPE_GOLDEN);
    assert.deepEqual(decodeShape(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) as ArrayBuffer), SHAPE);
});

test('empty blobs are empty and cut blobs throw', () => {
    assert.deepEqual(decodeShape(new Uint8Array()), []);
    assert.deepEqual(decodeChunk(0, new Uint8Array()), []);
    const shape = unhex(SHAPE_GOLDEN);
    assert.throws(() => decodeShape(shape.slice(0, -1)));
    const chunk = unhex(CHUNK_GOLDEN);
    assert.throws(() => decodeChunk(36_000, chunk.slice(0, -1)));
});
