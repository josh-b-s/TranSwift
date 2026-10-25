/**
 * gtfsKeyUtil.ts: composite (agency, id) keys.
 * Real feed ids contain colons (Melbourne's stop "vic:rail:CFD", pattern ids like "aus:vic:vic-02-CBE:_1"). With the key
 * built as `${id}:${agency}` and parsed by splitting on every colon, the wrong id came back and trains vanished from results.
 * So the agency, always a plain integer, goes first and the key is parsed on the first colon only; the rest is the id as-is.
 */

export function makeKey(agency: number, id: string): string {
    return `${agency}:${id}`;
}

export function parseKey(key: string): { agency: number; id: string } {
    const idx = key.indexOf(':');
    return {agency: Number(key.slice(0, idx)), id: key.slice(idx + 1)};
}
