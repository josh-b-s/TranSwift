import * as FileSystem from 'expo-file-system/legacy';

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
): Promise<{ uri: string; name: string }> {
    await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
    const task = FileSystem.createDownloadResumable(
        url,
        `${DOWNLOAD_DIR}${fileName}`,
        {},
        ({ totalBytesWritten, totalBytesExpectedToWrite }) =>
            onProgress(totalBytesWritten, Math.max(totalBytesExpectedToWrite, 0)),
    );
    const res = await task.downloadAsync();
    if (!res || res.status !== 200) throw new Error(`Download failed (HTTP ${res?.status ?? 'none'})`);
    return { uri: res.uri, name: fileName };
}
