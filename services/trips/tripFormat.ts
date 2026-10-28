import { SPEED_UNITS } from '@/constants/speedUnits';
import type { SpeedUnit } from '@/services/preferences/preferencesStore';
import type { BrokenRecord } from './personalBests';
import type { HistoryChartMode } from './periodTotals';
import type { SavedLeg } from './tripStore';

const PACE_BASE: Record<SpeedUnit, { meters: number; label: string }> = {
    kmh: { meters: 1000, label: '/km' },
    mph: { meters: 1609.344, label: '/mi' },
};

/** Length of one split, and its name, in the unit the rider reads pace in. */
export const splitLengthM = (unit: SpeedUnit) => PACE_BASE[unit].meters;
export const splitUnitName = (unit: SpeedUnit) => PACE_BASE[unit].label.slice(1);

export const shortDate = (ms: number) => new Date(ms).toLocaleDateString([], { day: 'numeric', month: 'short' });

/** Caption for a chart bar: the month for monthly bars, otherwise the day the trip or week started. */
export const formatChartLabel = (ms: number, mode: HistoryChartMode) =>
    mode === 'months' ? new Date(ms).toLocaleDateString([], { month: 'short' }) : shortDate(ms);

export function formatDistance(meters: number): string {
    return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`;
}

export function formatDuration(totalSeconds: number): string {
    const s = Math.round(totalSeconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    return m > 0 ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

/** For the live walk readout: how far the rider is from their best. */
export function formatPaceDelta(aheadS: number): string {
    if (Math.abs(aheadS) < 1) return 'On pace';
    return `${formatDuration(Math.abs(aheadS))} ${aheadS > 0 ? 'ahead' : 'behind'}`;
}

export function formatSpeed(mps: number, unit: SpeedUnit): string {
    if (mps <= 0) return '--';
    return `${(mps * SPEED_UNITS[unit].perMps).toFixed(1)} ${SPEED_UNITS[unit].label}`;
}

export function formatPace(mps: number, unit: SpeedUnit): string {
    if (mps <= 0) return '--';
    const seconds = Math.round(PACE_BASE[unit].meters / mps);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} ${PACE_BASE[unit].label}`;
}

export function recordLines(records: BrokenRecord[], unit: SpeedUnit): string[] {
    return records.flatMap(record => {
        if (record.kind === 'speed') {
            return [record.previousMps === null
                ? `${record.from} to ${record.to}: ${formatSpeed(record.speedMps, unit)}. Beat it next time.`
                : `New best, ${record.from} to ${record.to}: ${formatSpeed(record.speedMps, unit)} (was ${formatSpeed(record.previousMps, unit)}).`];
        }
        // The first trip has nothing to beat.
        return record.previousM > 0
            ? [`Longest walk yet: ${formatDistance(record.distanceM)} (was ${formatDistance(record.previousM)}).`]
            : [];
    });
}

export function tripTitle(legs: SavedLeg[]): string {
    return legs.length === 0 ? 'Trip' : `${legs[0].from} to ${legs[legs.length - 1].to}`;
}