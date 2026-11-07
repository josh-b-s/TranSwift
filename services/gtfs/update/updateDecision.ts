export type ConnectionType = 'wifi' | 'cellular' | 'other' | 'none';

export const UPDATE_CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

type Validators = { etag?: string; lastModified?: string };

/** Compares the validators saved at import with the server's current ones. A feed with none saved can't be judged. */
export function hasNewerVersion(saved: Validators, remote: Validators): boolean {
    if (saved.etag && remote.etag) return saved.etag !== remote.etag;
    if (saved.lastModified && remote.lastModified) return saved.lastModified !== remote.lastModified;
    return false;
}

export function isCheckDue(lastCheckedAt: number | undefined, now: number): boolean {
    return lastCheckedAt === undefined || now - lastCheckedAt >= UPDATE_CHECK_INTERVAL_MS;
}

export function shouldCheckForUpdate(input: {
    consented: boolean;
    connection: ConnectionType;
    lastCheckedAt: number | undefined;
    now: number;
}): boolean {
    return input.consented && input.connection === 'wifi' && isCheckDue(input.lastCheckedAt, input.now);
}
