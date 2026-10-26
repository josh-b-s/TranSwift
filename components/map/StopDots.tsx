import { memo } from 'react';
import { ACCENT } from '@/constants/themes';
import type { RepoStop } from '@/services/gtfs/core/stopRepo';
import { StopCircle } from '@/components/map/StopCircle';

// Memoised per stop: every pan produces a new list, and without this each of the (up to 150) circles is updated again.
const StopDot = memo(function StopDot({ stop, color }: { stop: RepoStop; color: string }) {
    return <StopCircle latitude={stop.stop_lat} longitude={stop.stop_lon} color={color} />;
});

/** A circle on each stop, in the colour of the route that serves it most. */
export function StopDots({ stops, colors }: { stops: RepoStop[]; colors: Map<number, string> }) {
    return (
        <>
            {stops.map(stop => <StopDot key={stop.stop_pk} stop={stop} color={colors.get(stop.stop_pk) ?? ACCENT} />)}
        </>
    );
}
