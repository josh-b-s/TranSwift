import type { GtfsDatabaseEntry } from '../import/gtfsDbRegistry';

/**
 * True if the server now reports a different version of the feed's zip than
 * the one imported. Null when it can't be told: no source URL, no validators
 * saved at import (older imports), or the server sent none.
 */
export async function hasNewerVersion(entry: GtfsDatabaseEntry): Promise<boolean | null> {
    const source = entry.source;
    if (!source || (!source.etag && !source.lastModified)) return null;

    const res = await fetch(source.url, { method: 'HEAD' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const etag = res.headers.get('etag');
    const lastModified = res.headers.get('last-modified');
    if (source.etag && etag) return etag !== source.etag;
    if (source.lastModified && lastModified) return lastModified !== source.lastModified;
    return null;
}
