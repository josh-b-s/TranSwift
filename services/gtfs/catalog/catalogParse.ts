import type { Coverage } from './coverage';
import { parseCsv } from './csvParse';

export type CatalogFeed = {
    id: string;
    provider: string;
    name: string;
    country: string;
    subdivision: string;
    municipality: string;
    /** Mobility Database mirror of the latest zip. Unlike the producer URL it never needs a key. */
    zipUrl: string;
    licenseUrl: string;
    /** Null when the catalog has no usable box for this feed. */
    box: Coverage | null;
};

// Header names as documented for feeds_v2.csv. Not yet checked against a live
// file, so parseCatalog throws if any of them is missing.
const COLUMN = {
    id: 'id',
    dataType: 'data_type',
    status: 'status',
    provider: 'provider',
    name: 'name',
    country: 'location.country_code',
    subdivision: 'location.subdivision_name',
    municipality: 'location.municipality',
    zipUrl: 'urls.latest',
    licenseUrl: 'urls.license',
} as const;

// Optional: if these names are wrong, location suggestions go quiet but browsing still works.
const BOX_COLUMNS = [
    'location.bounding_box.minimum_latitude',
    'location.bounding_box.maximum_latitude',
    'location.bounding_box.minimum_longitude',
    'location.bounding_box.maximum_longitude',
];

type Column = keyof typeof COLUMN;

function boxOf(row: string[], index: Map<string, number>): Coverage | null {
    const [minLat, maxLat, minLon, maxLon] = BOX_COLUMNS.map((c) => parseFloat(row[index.get(c) ?? -1] ?? ''));
    return [minLat, maxLat, minLon, maxLon].some(Number.isNaN) ? null : { minLat, maxLat, minLon, maxLon };
}

/** Active GTFS schedule feeds from the catalog CSV, sorted by country then provider. */
export function parseCatalog(text: string): CatalogFeed[] {
    const [header, ...rows] = parseCsv(text);
    if (!header) throw new Error('The feed catalog is empty.');

    const index = new Map(header.map((h, i) => [h.trim(), i]));
    const missing = Object.values(COLUMN).filter((c) => !index.has(c));
    if (missing.length > 0) throw new Error(`The feed catalog is missing columns: ${missing.join(', ')}`);

    const feeds: CatalogFeed[] = [];
    for (const row of rows) {
        const cell = (col: Column) => (row[index.get(COLUMN[col])!] ?? '').trim();

        const status = cell('status');
        if (cell('dataType') !== 'gtfs' || (status !== '' && status !== 'active')) continue;
        if (!cell('zipUrl')) continue;

        feeds.push({
            id: cell('id'),
            provider: cell('provider'),
            name: cell('name'),
            country: cell('country'),
            subdivision: cell('subdivision'),
            municipality: cell('municipality'),
            zipUrl: cell('zipUrl'),
            licenseUrl: cell('licenseUrl'),
            box: boxOf(row, index),
        });
    }

    return feeds.sort((a, b) => a.country.localeCompare(b.country) || a.provider.localeCompare(b.provider));
}
