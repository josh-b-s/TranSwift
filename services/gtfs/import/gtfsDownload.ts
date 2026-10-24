import * as FileSystem from 'expo-file-system/legacy';
import { CancelledError } from './cancelledError';

const DOWNLOAD_DIR = `${FileSystem.cacheDirectory}gtfs-download/`;

/** Size in bytes from a HEAD request, or null if the server doesn't say. */
export async function fetchZipSize(url: string): Promise<number | null> {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const length = Number(res.headers.get('content-length'));
    return length > 0 ? length : null;
}

/** Downloads `url` into the cache directory. `total` is 0 when the server sends no length. */
export async function downloadZip(
    url: string,
    fileName: string,
    onProgress: (written: number, total: number) => void,
    signal?: AbortSignal,
): Promise<{ uri: string; name: string; etag?: string; lastModified?: string }> {
    await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
    const target = `${DOWNLOAD_DIR}${fileName}`;
    const task = FileSystem.createDownloadResumable(
        url,
        target,
        {},
        ({ totalBytesWritten, totalBytesExpectedToWrite }) =>
            onProgress(totalBytesWritten, Math.max(totalBytesExpectedToWrite, 0)),
    );
    // pauseAsync stops the native transfer; the partial file is deleted below.
    signal?.addEventListener('abort', () => task.pauseAsync().catch(() => {}), { once: true });
    if (signal?.aborted) throw new CancelledError();

    let res: Awaited<ReturnType<typeof task.downloadAsync>>;
    try {
        res = await task.downloadAsync();
    } catch (err) {
        if (!signal?.aborted) throw err;
    }
    if (signal?.aborted) {
        await FileSystem.deleteAsync(target, { idempotent: true });
        throw new CancelledError();
    }
    if (!res || res.status !== 200) throw new Error(`Download failed (HTTP ${res?.status ?? 'none'})`);
    const header = (name: string) =>
        Object.entries(res.headers ?? {}).find(([k]) => k.toLowerCase() === name)?.[1];
    return { uri: res.uri, name: fileName, etag: header('etag'), lastModified: header('last-modified') };
}
