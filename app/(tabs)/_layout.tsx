import React from 'react';
import { Tabs } from 'expo-router';
import { History as HistoryIcon, Map as MapIcon, Settings as SettingsIcon } from 'lucide-react-native';
import { ACCENT, useThemeStyle } from '@/constants/themes';

export default function TabsLayout() {
    const theme = useThemeStyle();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: ACCENT,
                tabBarInactiveTintColor: theme.muted,
                tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
                tabBarStyle: {
                    backgroundColor: theme.surfaceColor,
                    borderTopWidth: 1,
                    borderTopColor: theme.hairline,
                    elevation: 0,
                    shadowOpacity: 0,
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Map',
                    tabBarIcon: ({ color, size }) => <MapIcon size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="history"
                options={{
                    title: 'History',
                    tabBarIcon: ({ color, size }) => <HistoryIcon size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Settings',
                    tabBarIcon: ({ color, size }) => <SettingsIcon size={size} color={color} />,
                }}
            />
        </Tabs>
    );
}