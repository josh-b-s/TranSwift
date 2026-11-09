/** What a BLOB column comes back as: op-sqlite gives an ArrayBuffer, better-sqlite3 (tests) a Buffer. */
export type BlobBytes = ArrayBuffer | Uint8Array;

export const toBytes = (blob: BlobBytes): Uint8Array => (blob instanceof Uint8Array ? blob : new Uint8Array(blob));

/** Reads LEB128 varints from a byte array. Values stay below 2^53, so plain arithmetic is enough. */
export class VarintReader {
    private pos = 0;
    private readonly bytes: Uint8Array;

    constructor(bytes: Uint8Array) {
        this.bytes = bytes;
    }

    get done(): boolean {
        return this.pos >= this.bytes.length;
    }

    /** Throws on bytes that end mid-varint, so a damaged blob fails loudly instead of decoding to a shorter list. */
    unsigned(): number {
        let n = 0;
        let scale = 1;
        for (;;) {
            const byte = this.bytes[this.pos++];
            if (byte === undefined) throw new Error('blob ends inside a varint');
            n += (byte & 0x7f) * scale;
            if (byte < 0x80) return n;
            scale *= 128;
        }
    }

    /** Zigzag: 0, 1, 2, 3 stand for 0, -1, 1, -2. */
    signed(): number {
        const n = this.unsigned();
        return n % 2 === 0 ? n / 2 : -(n + 1) / 2;
    }
}
