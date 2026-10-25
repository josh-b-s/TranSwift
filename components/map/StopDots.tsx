import { Polyline } from 'react-native-maps';
import { ACCENT } from '@/constants/themes';
import type { RepoStop } from '@/services/gtfs/core/stopRepo';
import { HALF_LENGTH_DEG } from '@/components/map/RideStopMarkers';

const DOT_WIDTH = 10;

/** A tappable dot on each stop, drawn the same way as the ride stop dots. */
export function StopDots({ stops, onSelect }: { stops: RepoStop[]; onSelect: (stop: RepoStop) => void }) {
    return (
        <>
            {stops.map(stop => (
                <Polyline
                    key={stop.stop_pk}
                    coordinates={[
                        { latitude: stop.stop_lat - HALF_LENGTH_DEG, longitude: stop.stop_lon },
                        { latitude: stop.stop_lat + HALF_LENGTH_DEG, longitude: stop.stop_lon },
                    ]}
                    strokeColor={ACCENT}
                    strokeWidth={DOT_WIDTH}
                    lineCap="round"
                    tappable
                    onPress={() => onSelect(stop)}
                />
            ))}
        </>
    );
}
