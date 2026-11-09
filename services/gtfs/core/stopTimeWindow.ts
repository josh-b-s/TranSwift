import type { QueryableDb } from '@/services/db/queryableDb';
import { type BlobBytes } from './varint';
import { decodeChunk, type StopTimeCall } from './stopTimeCodec';

type ChunkRow = { first_dep: number; data: BlobBytes };

/**
 * The calls at one stop with `fromSec <= departure <= toSec`, in departure order. SQL picks the chunks that can hold
 * them: those starting inside the window, plus the last one starting before it, whose calls run on past its first.
 */
export async function getStopCalls(db: QueryableDb, stopPk: number, fromSec: number, toSec: number): Promise<StopTimeCall[]> {
    const chunks = await db.getAllAsync<ChunkRow>(
        `SELECT first_dep, data FROM stop_time_chunks
         WHERE stop_pk = ?
           AND first_dep BETWEEN COALESCE((SELECT MAX(first_dep) FROM stop_time_chunks WHERE stop_pk = ? AND first_dep < ?), 0) AND ?
         ORDER BY first_dep, chunk_idx`,
        [stopPk, stopPk, fromSec, toSec],
    );
    return chunks
        .flatMap(c => decodeChunk(c.first_dep, c.data))
        .filter(c => c.departureSec >= fromSec && c.departureSec <= toSec);
}
