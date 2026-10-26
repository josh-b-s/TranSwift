import { memo } from 'react';
import { ACCENT } from '@/constants/themes';
import type { RepoStop } from '@/services/gtfs/core/stopRepo';
import { StopCircle } from '@/components/map/StopCircle';

// Memoised per stop: every pan produces a new list, and without this each of the (up to 150) circles is updated again.
const StopDot = memo(function StopDot({ stop, color, halfLength, onSelect }: {
    stop: RepoStop;
    color: string;
    halfLength: number;
    onSelect: (stop: RepoStop) => void;
}) {
    return <StopCircle latitude={stop.stop_lat} longitude={stop.stop_lon} color={color} halfLength={halfLength} onPress={() => onSelect(stop)} />;
});

/** A tappable circle on each stop, in the colour of the route that serves it most. */
export function StopDots({ stops, colors, halfLength, onSelect }: {
    stops: RepoStop[];
    colors: Map<number, string>;
    halfLength: number;
    onSelect: (stop: RepoStop) => void;
}) {
    return (
        <>
            {stops.map(stop => <StopDot key={stop.stop_pk} stop={stop} color={colors.get(stop.stop_pk) ?? ACCENT} halfLength={halfLength} onSelect={onSelect} />)}
        </>
    );
}
