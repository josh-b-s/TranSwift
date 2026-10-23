import type { CatalogFeed } from './catalogParse';
import { coverageArea, coverageContains, type Point } from './coverage';

/** Every word in `query` must appear somewhere in the feed's provider, name or place. */
export function filterFeeds(feeds: CatalogFeed[], query: string, country: string | null): CatalogFeed[] {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return feeds.filter((f) => {
        if (country && f.country !== country) return false;
        const haystack = `${f.provider} ${f.name} ${f.municipality} ${f.subdivision} ${f.country}`.toLowerCase();
        return words.every((w) => haystack.includes(w));
    });
}

export function countriesOf(feeds: CatalogFeed[]): string[] {
    return [...new Set(feeds.map((f) => f.country).filter(Boolean))].sort();
}

/** Feeds whose bounding box contains `at`, smallest first so a local agency beats a national aggregate. */
export function feedsAround(feeds: CatalogFeed[], at: Point): CatalogFeed[] {
    return feeds
        .filter((f) => f.box && coverageContains(f.box, at))
        .sort((a, b) => coverageArea(a.box!) - coverageArea(b.box!));
}

export type Region = { country: string; subdivision: string };

/** Box-less feeds in `region`. Very large feeds (PTV's) often have no box in the catalog, so coordinates can't find them. */
export function feedsInRegion(feeds: CatalogFeed[], region: Region): CatalogFeed[] {
    const country = region.country.toUpperCase();
    const subdivision = region.subdivision.trim().toLowerCase();
    return feeds
        .filter((f) => !f.box && f.country.toUpperCase() === country && f.subdivision.trim().toLowerCase() === subdivision)
        .sort((a, b) => Number(b.id.startsWith('mdb-')) - Number(a.id.startsWith('mdb-')) || a.provider.localeCompare(b.provider));
}
