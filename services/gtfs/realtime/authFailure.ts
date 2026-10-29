import type { RealtimeAuth } from '../catalog/realtimeParse';
import type { GtfsDatabaseEntry } from '../import/gtfsDbRegistry';
import { isAuthFailure } from './realtimeHttp';

type Listener = (entry: GtfsDatabaseEntry) => void;

let listener: Listener | null = null;
const reported = new Set<string>();

/** Where the user should put their key, as the catalog describes it. */
export function describeAuth(auth: RealtimeAuth | undefined): string {
    if (!auth) return 'The provider may want an API key. Check its developer page.';
    return auth.kind === 'header'
        ? `Get a key from the provider and send it as the "${auth.name}" header.`
        : `Get a key from the provider and add ${auth.name}=<your key> to each URL.`;
}

/** The screen that shows the alert registers here; there is one at a time. */
export function setAuthFailureListener(next: Listener | null): void {
    listener = next;
}

/** Tells the listener once per feed per launch when a realtime request came back 401 or 403. */
export function reportAuthFailure(entry: GtfsDatabaseEntry, results: PromiseSettledResult<unknown>[]): void {
    if (!listener || reported.has(entry.id)) return;
    const rejected = results.flatMap((r) => (r.status === 'rejected' ? [r.reason] : []));
    if (!rejected.some(isAuthFailure)) return;
    reported.add(entry.id);
    listener(entry);
}
