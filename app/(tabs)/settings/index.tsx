import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Bus, ChevronRight, type LucideIcon, SlidersHorizontal, Star } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { ACCENT, RADIUS, useThemeStyle } from '@/constants/themes';

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
        <ScrollView style={{ flex: 1, backgroundColor: theme.surfaceColor }} contentContainerStyle={{ padding: 16 }}>
            <View style={{ borderRadius: RADIUS.card, overflow: 'hidden', backgroundColor: theme.backgroundColor }}>
                {ITEMS.map((item, index) => (
                    <Pressable
                        key={item.route}
                        accessibilityRole="button"
                        onPress={() => router.push(item.route)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 }}
                    >
                        <View
                            style={{
                                width: 40, height: 40, borderRadius: 12,
                                backgroundColor: theme.accentSoft,
                                alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            <item.icon size={20} color={ACCENT} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: theme.color, fontSize: 16, fontWeight: '600' }}>{item.title}</Text>
                            <Text style={{ color: theme.muted, fontSize: 13, marginTop: 2 }}>{item.subtitle}</Text>
                        </View>
                        <ChevronRight size={18} color={theme.muted} />
                        {/* Rule starts at the text, not under the icon. */}
                        {index < ITEMS.length - 1 && (
                            <View style={{ position: 'absolute', left: 70, right: 0, bottom: 0, height: 1, backgroundColor: theme.hairline }} />
                        )}
                    </Pressable>
                ))}
            </View>
        </ScrollView>
    );
}
