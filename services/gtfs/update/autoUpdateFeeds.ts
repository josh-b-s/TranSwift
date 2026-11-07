import { loadCatalog } from '../catalog/feedCatalog';
import { importCatalogFeed } from '../import/gtfsCatalogImport';
import {
    getActiveDatabaseId,
    listDatabases,
    setActiveDatabase,
    setUpdateCheckedAt,
    type GtfsDatabaseEntry,
} from '../import/gtfsDbRegistry';
import { fetchRemoteValidators } from './fetchRemoteValidators';
import { hasNewerVersion, shouldCheckForUpdate, type ConnectionType } from './updateDecision';

let running = false;

async function updateFeed(entry: GtfsDatabaseEntry): Promise<void> {
    const source = entry.source!;
    const remote = await fetchRemoteValidators(source.url);
    await setUpdateCheckedAt(entry.id, Date.now());
    if (!hasNewerVersion(source, remote)) return;

    const feed = (await loadCatalog()).feeds.find((f) => f.id === source.id);
    if (!feed) return;

    const activeBefore = await getActiveDatabaseId();
    await importCatalogFeed(feed, () => {}, () => {}, entry.id);
    // An import always activates the new database; a feed the user wasn't using must not take over.
    if (activeBefore && activeBefore !== entry.id) await setActiveDatabase(activeBefore);
}

/** Redownloads every catalog feed that is due a check and has a newer version. Call it once per app start or foreground. */
export async function autoUpdateFeeds(consented: boolean, connection: ConnectionType): Promise<void> {
    if (running) return;
    running = true;
    try {
        const now = Date.now();
        const due = (await listDatabases()).filter(
            (d) => d.source && shouldCheckForUpdate({ consented, connection, lastCheckedAt: d.updateCheckedAt, now }),
        );
        for (const entry of due) {
            // One unreachable server should not stop the other feeds.
            await updateFeed(entry).catch((err) => console.warn(`[autoUpdate] ${entry.name} failed:`, err));
        }
    } finally {
        running = false;
    }
}
