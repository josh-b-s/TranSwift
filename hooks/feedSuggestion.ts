import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useRouter, type Router } from 'expo-router';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';
import { findFeedSuggestion, type FeedSuggestion } from '@/services/gtfs/suggestion/feedSuggestion';

function show(suggestion: FeedSuggestion, router: Router) {
    if (suggestion.kind === 'nearby') {
        const { feed } = suggestion;
        Alert.alert(
            'Transit data for your area',
            `${feed.provider} covers where you are. Download it to plan trips here?`,
            [
                { text: 'Not now', style: 'cancel' },
                {
                    text: 'View',
                    onPress: () => router.push({ pathname: '/settings/browse-feeds', params: { feedId: feed.id } }),
                },
            ],
        );
        return;
    }

    const { entry } = suggestion;
    const message = suggestion.kind === 'updated'
        ? `A newer version of "${entry.name}" is available. Re-download it?`
        : `The timetable in "${entry.name}" ${suggestion.daysLeft < 0 ? 'ended' : suggestion.daysLeft === 0 ? 'ends today' : `ends in ${suggestion.daysLeft} days`}. Re-download the latest version?`;
    Alert.alert(
        'Transit data is out of date',
        message,
        [
            { text: 'Not now', style: 'cancel' },
            {
                text: 'Re-download',
                onPress: () =>
                    router.push({
                        pathname: '/settings/browse-feeds',
                        params: { feedId: entry.source!.id, replaceId: entry.id },
                    }),
            },
        ],
    );
}

/** Once per app launch, on the first location fix, prompts about missing or expiring GTFS data. */
export function useFeedSuggestion() {
    const router = useRouter();
    const userLocation = useSelector((s: RootState) => s.location.userLocation);
    const checked = useRef(false);

    useEffect(() => {
        if (!userLocation || checked.current) return;
        checked.current = true;
        findFeedSuggestion(userLocation)
            .then((suggestion) => suggestion && show(suggestion, router))
            .catch((err) => console.warn('[feedSuggestion] check failed:', err));
    }, [userLocation, router]);
}
