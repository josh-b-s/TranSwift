import * as FileSystem from 'expo-file-system/legacy';
import { AppState } from 'react-native';
import { CancelledError } from './cancelledError';
import { waitToResume } from './waitToResume';

const DOWNLOAD_DIR = `${FileSystem.cacheDirectory}gtfs-download/`;

/** Size in bytes from a HEAD request, or null if the server doesn't say. */
export async function fetchZipSize(url: string): Promise<number | null> {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const length = Number(res.headers.get('content-length'));
    return length > 0 ? length : null;
}

/** Records how far a failed transfer got so `resumeAsync` can carry on from there. False when the platform can't. */
async function keepPartial(task: FileSystem.DownloadResumable): Promise<boolean> {
    try {
        await task.pauseAsync();
        return true;
    } catch (err) {
        console.warn('[gtfsDownload] cannot resume:', err);
        return false;
    }
}

/**
 * Downloads `url` into the cache directory. `total` is 0 when the server sends no length.
 *
 * A dropped connection keeps the bytes already on disk. If the app is in the background the download carries on by
 * itself once it is back. Otherwise `onInterrupted` is asked whether to continue (true) or give up (false); without
 * it the download fails.
 */
export async function downloadZip(
    url: string,
    fileName: string,
    onProgress: (written: number, total: number) => void,
    signal?: AbortSignal,
    onInterrupted?: (err: unknown) => Promise<boolean>,
): Promise<{ uri: string; name: string; etag?: string; lastModified?: string }> {
    await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
    const target = `${DOWNLOAD_DIR}${fileName}`;
    let expectedTotal = 0;
    const task = FileSystem.createDownloadResumable(
        url,
        target,
        {},
        ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
            const total = Math.max(totalBytesExpectedToWrite, 0);
            if (!expectedTotal) expectedTotal = total;
            onProgress(totalBytesWritten, total);
        },
    );
    const discardPartial = () => FileSystem.deleteAsync(target, { idempotent: true });
    // pauseAsync stops the native transfer; the partial file is deleted below.
    signal?.addEventListener('abort', () => task.pauseAsync().catch(() => {}), { once: true });
    if (signal?.aborted) throw new CancelledError();

    let res: Awaited<ReturnType<typeof task.downloadAsync>>;
    let resumes = 0;
    while (!signal?.aborted) {
        try {
            res = resumes === 0 ? await task.downloadAsync() : await task.resumeAsync();
            break;
        } catch (err) {
            if (signal?.aborted) break;
            if (!(await keepPartial(task))) {
                await discardPartial();
                throw err;
            }
            if (AppState.currentState !== 'active') {
                await waitToResume(signal);
            } else if (!onInterrupted || !(await onInterrupted(err))) {
                if (signal?.aborted) break;
                await discardPartial();
                throw err;
            }
            resumes++;
        }
    }
    if (signal?.aborted) {
        await discardPartial();
        throw new CancelledError();
    }
    // A resumed transfer answers 206 with only the rest of the file.
    if (!res || (res.status !== 200 && !(resumes > 0 && res.status === 206))) {
        await discardPartial();
        throw new Error(`Download failed (HTTP ${res?.status ?? 'none'})`);
    }
    // A server that ignores the resume request sends the whole file again, and the native side appends it to the partial one.
    if (resumes > 0 && expectedTotal > 0) {
        const info = await FileSystem.getInfoAsync(target);
        if (!info.exists || info.size !== expectedTotal) {
            await discardPartial();
            throw new Error('The resumed download came back the wrong size. Try again.');
        }
    }
    const header = (name: string) =>
        Object.entries(res.headers ?? {}).find(([k]) => k.toLowerCase() === name)?.[1];
    return { uri: res.uri, name: fileName, etag: header('etag'), lastModified: header('last-modified') };
}
