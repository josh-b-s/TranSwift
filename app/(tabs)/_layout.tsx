import React from 'react';
import { Tabs } from 'expo-router';
import { Map as MapIcon, Settings as SettingsIcon } from 'lucide-react-native';
import { useThemeStyle } from '@/constants/themes';

export default function TabsLayout() {
    const theme = useThemeStyle();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: '#2563eb',
                tabBarInactiveTintColor: theme.color + '88',
                tabBarStyle: {
                    backgroundColor: theme.surfaceColor,
                    borderTopWidth: 1,
                    borderTopColor: theme.color + '33',
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
                name="settings"
                options={{
                    title: 'Settings',
                    tabBarIcon: ({ color, size }) => <SettingsIcon size={size} color={color} />,
                }}
            />
        </Tabs>
    );
}