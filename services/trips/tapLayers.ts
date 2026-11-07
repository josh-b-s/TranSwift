type Situation = {
    hasPlace: boolean;
    tripRunning: boolean;
    /** A tapped stop's departures or a tapped vehicle's line is on show. */
    detailOpen: boolean;
    picking: boolean;
    viewingSavedTrip: boolean;
    debug: boolean;
};

/** Stop dots can be tapped: a chosen place's route takes them away, except under a running trip. */
export function stopsTappable(s: Situation): boolean {
    return !s.picking && !s.viewingSavedTrip && !s.debug && (!s.hasPlace || s.tripRunning);
}

/** The journey's lines and stops are drawn. A running trip's own route steps aside for a tapped detail and returns when it closes. */
export function journeyDrawn(s: Situation): boolean {
    return !s.debug && !s.viewingSavedTrip && !(s.tripRunning && s.detailOpen);
}

/** A chosen place closes the departures sheet, unless a trip is running, which always holds a place. */
export function placeClosesDepartures(s: Situation): boolean {
    return s.viewingSavedTrip || (s.hasPlace && !s.tripRunning);
}
