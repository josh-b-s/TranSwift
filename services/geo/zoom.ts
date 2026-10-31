/** Zoomed out past this (about 5 km tall) the stop dots and vehicles would only be clutter. */
const MAX_LATITUDE_DELTA = 0.05;

/** Whether the map is close enough in to draw stop dots and vehicles. */
export const isZoomedIn = (region: { latitudeDelta: number } | null) => region !== null && region.latitudeDelta <= MAX_LATITUDE_DELTA;
