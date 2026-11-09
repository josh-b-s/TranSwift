/** Where a trip is heading: its headsign when the feed has one, otherwise the name of its last stop. Departures and vehicles both name a line by this. */
export const terminusOf = (headsign: string | null, lastStopName: string | null): string | null => headsign ?? lastStopName;
