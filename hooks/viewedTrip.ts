import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { loadTrip, type SavedTrip } from '@/services/trips/tripStore';
import { summarizeTrip, walkPaths, type TripSummary } from '@/services/trips/tripSummary';
import { walkSplits, type Split } from '@/services/trips/tripSplits';
import { speedProfile } from '@/services/trips/speedProfile';
import { loadHistory, type HistoryTrip } from '@/services/trips/tripHistory';
import { matchTrips, type TripMatches } from '@/services/trips/matchedTrips';
import { tripLines, type MapLine } from '@/services/trips/tripLines';
import { recordLines, splitLengthM } from '@/services/trips/tripFormat';

const SPEED_BARS = 40;

export type ViewedTrip = {
    trip: SavedTrip;
    summary: TripSummary;
    lines: MapLine[];
    records: string[];
    splits: Split[];
    speeds: number[];
    matches: TripMatches | null;
    newBestKeys: Set<string>;
};

/** Loads the trip shown over the map and works out everything its sheet displays. Null until it has loaded. */
export function useViewedTrip(): { viewed: ViewedTrip | null; error: string | null } {
    const startedAt = useSelector((s: RootState) => s.tripView.startedAt);
    const unit = useSelector((s: RootState) => s.preferences.speedUnit);
    const [trip, setTrip] = useState<SavedTrip | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [history, setHistory] = useState<HistoryTrip[]>([]);

    useEffect(() => {
        setTrip(null);
        setError(null);
        if (startedAt === null) return;
        let cancelled = false;
        loadTrip(startedAt)
            .then(loaded => !cancelled && setTrip(loaded))
            .catch(err => !cancelled && setError(String(err)));
        loadHistory()
            .then(loaded => !cancelled && setHistory(loaded))
            .catch(err => console.warn('[trip] could not load history for matches:', err));
        return () => {
            cancelled = true;
        };
    }, [startedAt]);

    const viewed = useMemo((): ViewedTrip | null => {
        if (!trip) return null;
        const current = history.find(t => t.startedAt === trip.startedAt);
        return {
            trip,
            summary: summarizeTrip(trip),
            lines: tripLines(trip),
            records: recordLines(trip.records, unit),
            splits: walkSplits(walkPaths(trip), splitLengthM(unit)),
            speeds: speedProfile(walkPaths(trip), SPEED_BARS),
            matches: current ? matchTrips(history, current) : null,
            newBestKeys: new Set(trip.records.flatMap(r => (r.kind === 'speed' ? [`${r.from}>${r.to}`] : []))),
        };
    }, [trip, history, unit]);

    return { viewed, error };
}
