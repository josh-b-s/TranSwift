import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useThemeStyle } from '@/constants/themes';
import ImportProgressCard from '@/components/ImportProgressCard';
import { countriesOf, filterFeeds } from '@/services/gtfs/catalog/catalogFilter';
import type { CatalogFeed } from '@/services/gtfs/catalog/catalogParse';
import { loadCatalog, type CatalogResult } from '@/services/gtfs/catalog/feedCatalog';
import { importCatalogFeed } from '@/services/gtfs/import/gtfsCatalogImport';
import { DuplicateFeedError } from '@/services/gtfs/import/gtfsDbRegistry';
import { fetchZipSize } from '@/services/gtfs/import/gtfsDownload';
import {
    createProgressTracker,
    downloadProgress,
    formatMegabytes,
    type ImportProgress,
} from '@/services/gtfs/import/importProgress';

type Busy = { label: string; progress: ImportProgress } | null;

const ACCENT = '#2563eb';

export default function BrowseFeeds() {
    const theme = useThemeStyle();
    const router = useRouter();
    const { feedId, replaceId } = useLocalSearchParams<{ feedId?: string; replaceId?: string }>();
    const openedFeed = useRef(false);
    const [catalog, setCatalog] = useState<CatalogResult | null>(null);
    const [loadError, setLoadError] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [query, setQuery] = useState('');
    const [country, setCountry] = useState<string | null>(null);
    const [busy, setBusy] = useState<Busy>(null);
    const [error, setError] = useState('');

    const load = useCallback(async (force: boolean) => {
        setLoadError('');
        try {
            setCatalog(await loadCatalog(force));
        } catch (err) {
            setLoadError(`Couldn't load the feed list: ${String(err)}`);
        }
    }, []);

    useEffect(() => {
        load(false);
    }, [load]);

    // Arriving from a location suggestion: go straight to that feed's confirm dialog.
    useEffect(() => {
        if (!catalog || !feedId || openedFeed.current) return;
        openedFeed.current = true;
        const feed = catalog.feeds.find((f) => f.id === feedId);
        if (feed) handlePick(feed);
        else setError('That feed is no longer in the catalog.');
    }, [catalog, feedId]);

    async function handleRefresh() {
        setRefreshing(true);
        await load(true);
        setRefreshing(false);
    }

    const countries = useMemo(() => countriesOf(catalog?.feeds ?? []), [catalog]);
    const visible = useMemo(() => filterFeeds(catalog?.feeds ?? [], query, country), [catalog, query, country]);

    async function handlePick(feed: CatalogFeed) {
        setError('');
        setBusy({ label: feed.provider, progress: { fraction: 0, label: 'Checking file size', etaSeconds: null } });
        let size: number | null;
        try {
            size = await fetchZipSize(feed.zipUrl);
        } catch (err) {
            setError(`Couldn't reach the feed: ${String(err)}`);
            return;
        } finally {
            setBusy(null);
        }

        Alert.alert(
            `${replaceId ? 'Replace with the latest' : 'Download'} ${feed.provider}?`,
            [
                `Size: ${size ? formatMegabytes(size) : 'unknown'}`,
                `Licence: ${feed.licenseUrl || 'not listed'}`,
                'Credit the provider wherever the licence requires it.',
            ].join('\n'),
            [
                { text: 'Cancel', style: 'cancel' },
                { text: replaceId ? 'Replace' : 'Download', onPress: () => runImport(feed) },
            ],
        );
    }

    async function runImport(feed: CatalogFeed) {
        const track = createProgressTracker();
        setBusy({ label: feed.provider, progress: downloadProgress(0, 0) });
        try {
            await importCatalogFeed(
                feed,
                (written, total) => setBusy({ label: feed.provider, progress: downloadProgress(written, total) }),
                (p) => setBusy({ label: feed.provider, progress: track(p) }),
                replaceId,
            );
            router.back();
        } catch (err) {
            if (err instanceof DuplicateFeedError) {
                if (replaceId) Alert.alert('Already up to date', "The provider hasn't published a newer version yet.");
                else Alert.alert('Already imported', err.message);
            } else {
                setError(`Import failed: ${String(err)}`);
            }
        } finally {
            setBusy(null);
        }
    }

    function renderFeed({ item }: { item: CatalogFeed }) {
        const place = [item.municipality, item.subdivision, item.country].filter(Boolean).join(', ');
        return (
            <Pressable
                disabled={busy !== null}
                onPress={() => handlePick(item)}
                style={{
                    padding: 16,
                    borderRadius: 16,
                    backgroundColor: theme.backgroundColor,
                    opacity: busy ? 0.5 : 1,
                }}
            >
                <Text style={{ color: theme.color, fontSize: 16, fontWeight: '600' }}>{item.provider}</Text>
                <Text style={{ color: theme.color, opacity: 0.5, fontSize: 13, marginTop: 2 }}>{place}</Text>
                {!!item.name && (
                    <Text style={{ color: theme.color, opacity: 0.5, fontSize: 13 }}>{item.name}</Text>
                )}
                <Text style={{ color: theme.color, opacity: 0.5, fontSize: 12, marginTop: 4 }}>
                    {item.licenseUrl ? 'Licence listed' : 'No licence listed'}
                </Text>
            </Pressable>
        );
    }

    const header = (
        <View style={{ gap: 12 }}>
            <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search provider or place"
                placeholderTextColor={theme.color + '66'}
                autoCorrect={false}
                style={{
                    color: theme.color,
                    fontSize: 16,
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: theme.backgroundColor,
                }}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {[null, ...countries].map((code) => {
                    const selected = code === country;
                    return (
                        <Pressable
                            key={code ?? 'all'}
                            onPress={() => setCountry(code)}
                            style={{
                                paddingHorizontal: 14,
                                paddingVertical: 8,
                                borderRadius: 999,
                                backgroundColor: selected ? ACCENT : theme.backgroundColor,
                            }}
                        >
                            <Text style={{ color: selected ? '#ffffff' : theme.color, fontSize: 13, fontWeight: '600' }}>
                                {code ?? 'All'}
                            </Text>
                        </Pressable>
                    );
                })}
            </ScrollView>

            {catalog?.stale && (
                <Text style={{ color: theme.color, opacity: 0.5, fontSize: 12 }}>
                    Couldn't refresh the list. Showing the copy from {new Date(catalog.fetchedAt).toLocaleDateString()}.
                </Text>
            )}
            {busy && <ImportProgressCard fileName={busy.label} progress={busy.progress} />}
            {!!error && <Text style={{ color: '#ef4444', fontSize: 12 }}>{error}</Text>}
        </View>
    );

    return (
        <FlatList
            style={{ flex: 1, backgroundColor: theme.surfaceColor }}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            data={visible}
            keyExtractor={(f) => f.id}
            renderItem={renderFeed}
            ListHeaderComponent={header}
            ListEmptyComponent={
                <View style={{ gap: 8, alignItems: 'center', paddingVertical: 24 }}>
                    <Text style={{ color: loadError ? '#ef4444' : theme.color, opacity: loadError ? 1 : 0.5, fontSize: 13 }}>
                        {loadError || (catalog ? 'No feeds match.' : 'Loading feeds...')}
                    </Text>
                    {!!loadError && (
                        <Pressable onPress={handleRefresh}>
                            <Text style={{ color: ACCENT, fontSize: 14, fontWeight: '600' }}>Retry</Text>
                        </Pressable>
                    )}
                </View>
            }
            refreshing={refreshing}
            onRefresh={handleRefresh}
            keyboardShouldPersistTaps="handled"
        />
    );
}
