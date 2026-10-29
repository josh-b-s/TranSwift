/** Splits "Name: value" into a header, or null when it is not one. */
export function parseHeader(header: string): [string, string] | null {
    const i = header.indexOf(':');
    if (i <= 0) return null;
    return [header.slice(0, i).trim(), header.slice(i + 1).trim()];
}

/** The auth header saved with a feed, as a headers object. Empty when there is none or it is malformed. */
export function authHeaders(header: string | undefined): Record<string, string> {
    const parsed = header ? parseHeader(header) : null;
    return parsed ? { [parsed[0]]: parsed[1] } : {};
}

/** Adds a saved "name=value" key to a URL's query string. Left alone when the key is incomplete or the URL already has that parameter. */
export function withQuery(url: string, query: string | undefined): string {
    const trimmed = query?.trim() ?? '';
    const i = trimmed.indexOf('=');
    const name = i > 0 ? trimmed.slice(0, i).trim() : '';
    const value = i > 0 ? trimmed.slice(i + 1).trim() : '';
    if (!name || !value) return url;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`[?&]${escaped}=`).test(url)) return url;
    return `${url}${url.includes('?') ? '&' : '?'}${name}=${value}`;
}

export class RealtimeHttpError extends Error {
    readonly status: number;

    constructor(status: number) {
        super(`HTTP ${status}`);
        this.status = status;
    }
}

/** True for a 401 or 403 response, which usually means the producer wants a key. */
export function isAuthFailure(reason: unknown): boolean {
    return reason instanceof RealtimeHttpError && (reason.status === 401 || reason.status === 403);
}

type KeyConfig = { realtimeHeader?: string; realtimeQuery?: string };

/** Fetches one realtime URL with the feed's saved key, sent as a header, a query parameter or both. */
export function fetchWithKey(config: KeyConfig, url: string): Promise<ArrayBuffer> {
    return fetchFeedBytes(withQuery(url, config.realtimeQuery), authHeaders(config.realtimeHeader));
}

export async function fetchFeedBytes(url: string, headers: Record<string, string>): Promise<ArrayBuffer> {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new RealtimeHttpError(res.status);
    return res.arrayBuffer();
}
