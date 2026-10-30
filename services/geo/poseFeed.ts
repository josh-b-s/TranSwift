import type { LatLng } from 'react-native-maps';

type Listener = (position: LatLng | null) => void;

/** Broadcasts the position the map camera is aimed at, or null when it is not following anyone. */
export type PoseFeed = {
    emit: (position: LatLng | null) => void;
    subscribe: (listener: Listener) => () => void;
};

export function createPoseFeed(): PoseFeed {
    const listeners = new Set<Listener>();
    return {
        emit: position => listeners.forEach(listener => listener(position)),
        subscribe: listener => {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
    };
}
