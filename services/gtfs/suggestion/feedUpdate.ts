import type { GtfsDatabaseEntry } from '../import/gtfsDbRegistry';
import { fetchRemoteValidators } from '../update/fetchRemoteValidators';
import { hasNewerVersion as hasNewerValidators } from '../update/updateDecision';

/**
 * True if the server now reports a different version of the feed's zip than
 * the one imported. Null when it can't be told: no source URL or no validators
 * saved at import (older imports).
 */
export async function hasNewerVersion(entry: GtfsDatabaseEntry): Promise<boolean | null> {
    const source = entry.source;
    if (!source || (!source.etag && !source.lastModified)) return null;
    return hasNewerValidators(source, await fetchRemoteValidators(source.url));
}
