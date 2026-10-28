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

export async function fetchFeedBytes(url: string, headers: Record<string, string>): Promise<ArrayBuffer> {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.arrayBuffer();
}
