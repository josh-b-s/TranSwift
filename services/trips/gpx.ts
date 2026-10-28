import { decodeLine } from './lineCodec';
import { decodePath } from './pathCodec';
import { tripTitle } from './tripFormat';
import type { SavedLeg, SavedTrip } from './tripStore';

const escapeXml = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const point = (latitude: number, longitude: number, timeMs?: number) => {
    const time = timeMs === undefined ? '' : `<time>${new Date(timeMs).toISOString()}</time>`;
    return `<trkpt lat="${latitude.toFixed(6)}" lon="${longitude.toFixed(6)}">${time}</trkpt>`;
};

function legTrack(leg: SavedLeg): string {
    // Walks carry the rider's timed fixes. A ride is the line the vehicle follows, so it has no times.
    const name = leg.kind === 'walk' ? `Walk: ${leg.from} to ${leg.to}` : `${leg.routeName}: ${leg.from} to ${leg.to}`;
    const points = leg.kind === 'walk'
        ? decodePath(leg.path).map(s => point(s.latitude, s.longitude, s.time))
        : decodeLine(leg.line).map(c => point(c.latitude, c.longitude));
    return `<trk><name>${escapeXml(name)}</name><type>${leg.kind === 'walk' ? 'walking' : 'transit'}</type><trkseg>${points.join('')}</trkseg></trk>`;
}

/** The trip as GPX 1.1: one track per leg, in trip order. */
export function tripToGpx(trip: SavedTrip): string {
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<gpx version="1.1" creator="TranSwift" xmlns="http://www.topografix.com/GPX/1/1">',
        `<metadata><name>${escapeXml(tripTitle(trip.legs))}</name><time>${new Date(trip.startedAt).toISOString()}</time></metadata>`,
        ...trip.legs.map(legTrack),
        '</gpx>',
    ].join('\n');
}
