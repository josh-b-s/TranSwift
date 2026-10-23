import type { SpeedUnit } from '@/services/preferences/preferencesStore';

export const SPEED_UNITS: Record<SpeedUnit, { label: string; spoken: string; perMps: number }> = {
    kmh: { label: 'km/h', spoken: 'kilometres per hour', perMps: 3.6 },
    mph: { label: 'mph', spoken: 'miles per hour', perMps: 2.23694 },
};
