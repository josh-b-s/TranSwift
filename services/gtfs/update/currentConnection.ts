import * as Network from 'expo-network';
import type { ConnectionType } from './updateDecision';

export async function currentConnection(): Promise<ConnectionType> {
    const state = await Network.getNetworkStateAsync();
    if (!state.isConnected) return 'none';
    if (state.type === Network.NetworkStateType.WIFI) return 'wifi';
    if (state.type === Network.NetworkStateType.CELLULAR) return 'cellular';
    return 'other';
}
