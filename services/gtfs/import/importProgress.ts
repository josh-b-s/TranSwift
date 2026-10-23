import type { ImportProgressEvent } from './rustGtfsImporter';

export type ImportProgress = {
    /** Overall estimate, 0 to 1. Never goes backwards. */
    fraction: number;
    label: string;
    detail?: string;
    /** Null until there is enough elapsed time to extrapolate from. */
    etaSeconds: number | null;
    /** True while the work can still be stopped. */
    cancellable?: boolean;
};

// The Rust importer reports no overall percentage, only per-table counts, so
// the bar is built from these hand-estimated shares of total import time.
const PHASE = {
    prepareEnd: 0.03,
    agenciesEnd: 0.85,
    indexesEnd: 0.91,
    finishEnd: 0.92,
};

// Order and shares match process_agency() in import.rs.
const STAGES: { key: string; label: string; share: number }[] = [
    { key: 'stops', label: 'Stops', share: 0.03 },
    { key: 'routes', label: 'Routes', share: 0.01 },
    { key: 'calendar', label: 'Service calendar', share: 0.01 },
    { key: 'calendar_dates', label: 'Calendar exceptions', share: 0.01 },
    { key: 'trips', label: 'Trips', share: 0.08 },
    { key: 'stop_times', label: 'Stop times', share: 0.4 },
    { key: 'patterns', label: 'Route patterns', share: 0.04 },
    { key: 'pattern_hops/headway', label: 'Travel times and frequencies', share: 0.2 },
    { key: 'shapes', label: 'Route shapes', share: 0.22 },
];

// stop_times and shapes report row counts with no total until they finish.
// Their share fills along this curve instead: half full at this many rows.
const UNKNOWN_TOTAL_HALF_ROWS = 2_000_000;

const MIN_FRACTION_FOR_ETA = 0.08;

function stageFraction(inserted: number, total: number): number {
    if (total > 0) return Math.min(inserted / total, 1);
    return inserted / (inserted + UNKNOWN_TOTAL_HALF_ROWS);
}

/** Returns a function that turns each importer event into display-ready progress. */
export function createProgressTracker(): (e: ImportProgressEvent) => ImportProgress {
    const startedAt = Date.now();
    let feedCount = 1;
    let feedIndex = 1;
    let best = 0;
    let label = 'Starting import';
    let detail: string | undefined;

    const agenciesAt = (feedProgress: number) =>
        PHASE.prepareEnd + (PHASE.agenciesEnd - PHASE.prepareEnd) * (((feedIndex - 1) + feedProgress) / feedCount);

    return ({ table, inserted, total }) => {
        let raw = best;
        detail = undefined;

        const found = table.match(/^found (\d+) feed/);
        const agencyStart = table.match(/^agency (\d+)\/(\d+)/);
        const agencyStage = table.match(/^agency (\d+) · (.+)$/);

        if (table.startsWith('reading zip')) {
            label = 'Reading zip';
            raw = 0;
        } else if (table.startsWith('read zip') || table.startsWith('scanning')) {
            label = 'Scanning for feeds';
            raw = 0.01;
        } else if (found) {
            feedCount = Math.max(parseInt(found[1], 10), 1);
            raw = PHASE.prepareEnd;
        } else if (agencyStart) {
            feedIndex = parseInt(agencyStart[1], 10);
            feedCount = parseInt(agencyStart[2], 10);
            label = 'Importing feed';
            raw = agenciesAt(0);
        } else if (agencyStage) {
            feedIndex = parseInt(agencyStage[1], 10);
            const stageIdx = STAGES.findIndex(s => s.key === agencyStage[2]);
            if (stageIdx >= 0) {
                const done = STAGES.slice(0, stageIdx).reduce((sum, s) => sum + s.share, 0);
                raw = agenciesAt(done + STAGES[stageIdx].share * stageFraction(inserted, total));
                label = STAGES[stageIdx].label;
                if (inserted > 0 && inserted !== total) {
                    detail = total > 0
                        ? `${inserted.toLocaleString()} of ${total.toLocaleString()}`
                        : `${inserted.toLocaleString()} rows`;
                }
            }
        } else if (table.startsWith('all agencies')) {
            label = 'Saving feeds';
            raw = PHASE.agenciesEnd;
        } else if (table.startsWith('building indexes')) {
            label = 'Building search indexes';
            raw = PHASE.agenciesEnd;
        } else if (table.startsWith('indexes built')) {
            raw = PHASE.indexesEnd;
        } else if (table.startsWith('checkpointing')) {
            label = 'Finishing up';
            raw = PHASE.indexesEnd;
        } else if (table.startsWith('WAL checkpointed')) {
            raw = PHASE.finishEnd;
        } else if (table.startsWith('vacuuming')) {
            label = 'Compacting database';
            raw = PHASE.finishEnd;
        } else if (table.startsWith('vacuum done')) {
            raw = 1;
        }

        best = Math.max(best, raw);

        if (feedCount > 1 && best > PHASE.prepareEnd && best < PHASE.agenciesEnd) {
            const feedLine = `Feed ${feedIndex} of ${feedCount}`;
            detail = detail ? `${feedLine}, ${detail}` : feedLine;
        }

        const elapsed = (Date.now() - startedAt) / 1000;
        const etaSeconds = best >= MIN_FRACTION_FOR_ETA && best < 1
            ? (elapsed * (1 - best)) / best
            : null;

        // Once the agencies are saved only quick finishing steps remain, so cancelling no longer helps.
        return { fraction: best, label, detail, etaSeconds, cancellable: best < PHASE.agenciesEnd };
    };
}

/** "About 2 min left", rounded so it doesn't flicker every update. */
export function formatEta(seconds: number | null): string | null {
    if (seconds === null) return null;
    if (seconds < 15) return 'Almost done';
    if (seconds < 90) return `About ${Math.round(seconds / 10) * 10} sec left`;
    return `About ${Math.round(seconds / 60)} min left`;
}

const MEGABYTE = 1024 * 1024;

export function formatMegabytes(bytes: number): string {
    return bytes >= 10 * MEGABYTE
        ? `${Math.round(bytes / MEGABYTE)} MB`
        : `${(bytes / MEGABYTE).toFixed(1)} MB`;
}

/** Progress for the download step, shown before the import's own bar starts. */
export function downloadProgress(written: number, total: number): ImportProgress {
    return {
        fraction: total > 0 ? Math.min(written / total, 1) : 0,
        label: 'Downloading',
        detail: total > 0
            ? `${formatMegabytes(written)} of ${formatMegabytes(total)}`
            : `${formatMegabytes(written)} so far`,
        etaSeconds: null,
        cancellable: true,
    };
}
