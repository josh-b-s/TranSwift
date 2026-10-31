import { haversineMeters } from '@/services/geo/geoUtil';
import type { LatLng } from '@/services/places/places';

/** A rider this close to the journey's start counts as being at it. */
export const AT_START_M = 75;
/** How far the rider must get from where they were last seen at the start to count as having set off. */
export const SET_OFF_M = 50;
/** How much nearer to where the first step ends the rider must be than they were at the start. */
export const CLOSER_M = 30;
// Worse fixes jump around more than SET_OFF_M, so a rider standing still could trigger.
const MAX_ACCURACY_M = 25;

export type FollowFix = LatLng & { accuracyM: number | null };

const meters = (a: LatLng, b: LatLng) =>
    haversineMeters({ lat: a.latitude, lon: a.longitude }, { lat: b.latitude, lon: b.longitude });

/** Tells when a rider who was at the start of a journey has walked away from it, towards where its first step ends. */
export function createFollowDetector(start: LatLng, firstStepEnd: LatLng) {
    // Where the rider was last seen at the start.
    let anchor: LatLng | null = null;

    return {
        update(fix: FollowFix): boolean {
            if (fix.accuracyM === null || fix.accuracyM > MAX_ACCURACY_M) return false;
            if (anchor === null) {
                if (meters(fix, start) <= AT_START_M) anchor = fix;
                return false;
            }
            const movedM = meters(fix, anchor);
            const closerM = meters(anchor, firstStepEnd) - meters(fix, firstStepEnd);
            if (movedM >= SET_OFF_M && closerM >= CLOSER_M) return true;
            // Wandered off elsewhere, so the next time they are at the start is a fresh start.
            if (meters(fix, start) > AT_START_M) anchor = null;
            return false;
        },
    };
}
