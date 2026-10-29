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
        ? `Get a key from the provider and put it in the Header box as "${auth.name}: <your key>".`
        : `Get a key from the provider and put it in the Query key box as ${auth.name}=<your key>.`;
}

/** The screen that shows the alert registers here; there is one at a time. */
export function setAuthFailureListener(next: Listener | null): void {
    listener = next;
}

/** Lets a feed report again, for when its realtime settings changed and the new ones may still be refused. */
export function forgetAuthFailure(entryId: string): void {
    reported.delete(entryId);
}

/** Tells the listener once per feed per launch when a realtime request came back 401 or 403. */
export function reportAuthFailure(entry: GtfsDatabaseEntry, results: PromiseSettledResult<unknown>[]): void {
    if (!listener || reported.has(entry.id)) return;
    const rejected = results.flatMap((r) => (r.status === 'rejected' ? [r.reason] : []));
    if (!rejected.some(isAuthFailure)) return;
    reported.add(entry.id);
    listener(entry);
}
