import * as FileSystem from 'expo-file-system/legacy';
import { NO_BESTS, type PersonalBests } from './personalBests';

const BESTS_PATH = `${FileSystem.documentDirectory}personalBests.json`;

export async function loadBests(): Promise<PersonalBests> {
    const { exists } = await FileSystem.getInfoAsync(BESTS_PATH);
    if (!exists) return NO_BESTS;
    return JSON.parse(await FileSystem.readAsStringAsync(BESTS_PATH)) as PersonalBests;
}

export async function saveBests(bests: PersonalBests): Promise<void> {
    await FileSystem.writeAsStringAsync(BESTS_PATH, JSON.stringify(bests));
}
