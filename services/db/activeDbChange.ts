type Listener = () => void;

const listeners = new Set<Listener>();

/** Runs `listener` whenever the active database path changes. Returns the unsubscribe function. */
export function onActiveDbChange(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function notifyActiveDbChange(): void {
    listeners.forEach(listener => listener());
}
