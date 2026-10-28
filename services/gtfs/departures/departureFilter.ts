import type { Departure } from './stopDepartures';

export type DepartureFilter = { line: string | null; terminus: string | null };

export const NO_FILTER: DepartureFilter = { line: null, terminus: null };

const unique = (values: string[]) => [...new Set(values)];

/** Lines serving the stop, in the order of their first departure. */
export const filterLines = (departures: Departure[]) => unique(departures.map(d => d.routeName));

/** Destinations to offer: those of the chosen line, or of every line when none is chosen. */
export function filterTermini(departures: Departure[], line: string | null) {
    return unique(departures.filter(d => !line || d.routeName === line).map(d => d.terminus).filter(Boolean));
}

export const applyDepartureFilter = <T extends Departure>(departures: T[], { line, terminus }: DepartureFilter): T[] =>
    departures.filter(d => (!line || d.routeName === line) && (!terminus || d.terminus === terminus));

/** Picking a line clears a destination that line does not serve. */
export function pickLine(filter: DepartureFilter, departures: Departure[], line: string | null): DepartureFilter {
    const keepTerminus = filter.terminus !== null && filterTermini(departures, line).includes(filter.terminus);
    return { line, terminus: keepTerminus ? filter.terminus : null };
}
