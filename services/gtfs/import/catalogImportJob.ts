import { useSyncExternalStore } from 'react';
import type { CatalogFeed } from '../catalog/catalogParse';
import { CancelledError } from './cancelledError';
import { importCatalogFeed } from './gtfsCatalogImport';
import { DuplicateFeedError } from './gtfsDbRegistry';
import { createProgressTracker, downloadProgress, type ImportProgress } from './importProgress';

export type CatalogImportJob = { label: string; progress: ImportProgress; stalled: boolean };

/** How the last job ended, when the person should be told. Cleared by the screen that shows it. */
export type CatalogImportNotice = { kind: 'error' | 'info'; message: string };

let job: CatalogImportJob | null = null;
let notice: CatalogImportNotice | null = null;
let abort: AbortController | null = null;
// Set while a dropped download waits for the person to continue or give up.
let answer: ((again: boolean) => void) | null = null;
const listeners = new Set<() => void>();

function set(next: CatalogImportJob | null, nextNotice: CatalogImportNotice | null = notice) {
    job = next;
    notice = nextNotice;
    listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
};

export const useCatalogImportJob = () => useSyncExternalStore(subscribe, () => job);
export const useCatalogImportNotice = () => useSyncExternalStore(subscribe, () => notice);

export function clearCatalogImportNotice(): void {
    if (notice) set(job, null);
}

function askToContinue(): Promise<boolean> {
    if (job) set({ ...job, stalled: true });
    return new Promise((resolve) => {
        answer = (again) => {
            answer = null;
            if (job) set({ ...job, stalled: false });
            resolve(again);
        };
    });
}

export function cancelCatalogImport(): void {
    abort?.abort();
    answer?.(false);
}

export function continueCatalogImport(): void {
    answer?.(true);
}

/** Downloads and imports a catalog feed in the background of whichever screen is showing. One at a time. */
export async function startCatalogImport(feed: CatalogFeed, replaceId?: string): Promise<void> {
    if (job) return;
    const track = createProgressTracker();
    const controller = new AbortController();
    abort = controller;
    set({ label: feed.provider, progress: downloadProgress(0, 0), stalled: false }, null);
    const progress = (p: ImportProgress) => job && set({ ...job, progress: p });
    try {
        await importCatalogFeed(
            feed,
            (written, total) => progress(downloadProgress(written, total)),
            (p) => progress(track(p)),
            replaceId,
            controller.signal,
            askToContinue,
        );
        set(null, null);
    } catch (err) {
        if (err instanceof CancelledError) set(null, null);
        else if (err instanceof DuplicateFeedError) {
            set(null, replaceId
                ? { kind: 'info', message: "Already up to date. The provider hasn't published a newer version yet." }
                : { kind: 'info', message: err.message });
        } else set(null, { kind: 'error', message: `Import failed: ${String(err)}` });
    } finally {
        abort = null;
        answer = null;
    }
}
