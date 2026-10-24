import { useSyncExternalStore } from 'react';
import { getSimulation, subscribeSimulation } from '@/services/debug/locationSimulator';

/** The running location simulation, or null when there isn't one. */
export const useSimulation = () => useSyncExternalStore(subscribeSimulation, getSimulation);
