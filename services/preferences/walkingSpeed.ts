import type { WalkingSpeedOption } from './preferencesStore';

export const formatMps = (mps: number) => `${mps.toFixed(1)} m/s`;

/** What a preset reads as in a list: its name when it has one, otherwise its speed. */
export const walkingSpeedLabel = (option: Pick<WalkingSpeedOption, 'label' | 'mps'>) =>
    option.label?.trim() ? option.label : formatMps(option.mps);
