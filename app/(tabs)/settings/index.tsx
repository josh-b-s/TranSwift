import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Bus, ChevronRight, type LucideIcon, SlidersHorizontal, Star } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useThemeStyle } from '@/constants/themes';

type MenuItem = {
    icon: LucideIcon;
    title: string;
    subtitle: string;
    route: '/settings/preferences' | '/settings/saved-places' | '/settings/gtfs';
};

const ITEMS: MenuItem[] = [
    {
        icon: SlidersHorizontal,
        title: 'Preferences',
        subtitle: 'Theme, default walking speed, units',
        route: '/settings/preferences',
    },
    {
        icon: Star,
        title: 'Saved places',
        subtitle: 'Rename or remove your starred places and stops',
        route: '/settings/saved-places',
    },
    {
        icon: Bus,
        title: 'GTFS Data',
        subtitle: 'Manage transit regions and feeds',
        route: '/settings/gtfs',
    },
];

export default function SettingsMenu() {
    const theme = useThemeStyle();
    const router = useRouter();

    return (
        <ScrollView style={{ flex: 1, backgroundColor: theme.surfaceColor }} contentContainerStyle={{ padding: 16, gap: 12 }}>
            {ITEMS.map((item) => (
                <Pressable
                    key={item.route}
                    onPress={() => router.push(item.route)}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 14,
                        padding: 16,
                        borderRadius: 16,
                        backgroundColor: theme.backgroundColor,
                    }}
                >
                    <View
                        style={{
                            width: 40, height: 40, borderRadius: 12,
                            backgroundColor: '#2563eb22',
                            alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        <item.icon size={20} color="#2563eb" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.color, fontSize: 16, fontWeight: '600' }}>{item.title}</Text>
                        <Text style={{ color: theme.color, opacity: 0.5, fontSize: 13, marginTop: 2 }}>{item.subtitle}</Text>
                    </View>
                    <ChevronRight size={18} color={theme.color + '66'} />
                </Pressable>
            ))}
        </ScrollView>
    );
}