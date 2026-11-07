import React from 'react';
import { Stack } from 'expo-router';
import ScreenHeader from '@/components/ui/ScreenHeader';
import { useThemeStyle } from '@/constants/themes';

export default function SettingsLayout() {
    const theme = useThemeStyle();

    return (
        <Stack
            screenOptions={{
                // Same big title as the History tab.
                header: ({ options, back, navigation }) => (
                    <ScreenHeader title={options.title ?? ''} onBack={back ? navigation.goBack : options.title === 'Settings' ? undefined : () => navigation.navigate('index')} />
                ),
                // Shows behind a screen while it slides, so it must match the screens or a light strip flashes in dark mode.
                contentStyle: { backgroundColor: theme.surfaceColor },
            }}
        >
            <Stack.Screen name="index" options={{ title: 'Settings' }} />
            <Stack.Screen name="preferences" options={{ title: 'Preferences' }} />
            <Stack.Screen name="saved-places" options={{ title: 'Saved places' }} />
            <Stack.Screen name="gtfs" options={{ title: 'GTFS Data' }} />
            <Stack.Screen name="browse-feeds" options={{ title: 'Browse Feeds' }} />
        </Stack>
    );
}
