/** The etag and last-modified the server reports for a feed zip, from a HEAD request. */
export async function fetchRemoteValidators(url: string): Promise<{ etag?: string; lastModified?: string }> {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return {
        etag: res.headers.get('etag') ?? undefined,
        lastModified: res.headers.get('last-modified') ?? undefined,
    };
}
