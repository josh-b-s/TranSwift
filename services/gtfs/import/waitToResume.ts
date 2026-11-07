import { AppState } from 'react-native';

// Network access is often not back the instant the app is.
const SETTLE_MS = 2000;

function whenActive(signal?: AbortSignal): Promise<void> {
    if (AppState.currentState === 'active') return Promise.resolve();
    return new Promise((resolve) => {
        const done = () => {
            sub.remove();
            signal?.removeEventListener('abort', done);
            resolve();
        };
        const sub = AppState.addEventListener('change', (state) => state === 'active' && done());
        signal?.addEventListener('abort', done, { once: true });
    });
}

/** Waits for the app to be in the foreground, since a download resumed in the background just fails again. Returns early on abort. */
export async function waitToResume(signal?: AbortSignal): Promise<void> {
    await whenActive(signal);
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
}
