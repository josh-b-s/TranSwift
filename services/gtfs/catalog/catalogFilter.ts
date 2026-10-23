import type { CatalogFeed } from './catalogParse';

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
