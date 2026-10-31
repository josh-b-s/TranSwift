import React, { useState } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { CircleAlert } from 'lucide-react-native';
import { RADIUS, WARNING, useThemeStyle } from '@/constants/themes';
import type { ResolvedAlert } from '@/services/gtfs/alerts/serviceAlert';

/** Alert notices, collapsed to their headline. Tap one to read the rest. Renders nothing without alerts. */
export default function ServiceAlertList({ alerts, style }: { alerts: ResolvedAlert[]; style?: ViewStyle }) {
    const theme = useThemeStyle();
    const [openId, setOpenId] = useState<string | null>(null);
    if (alerts.length === 0) return null;

    return (
        <View style={[{ gap: 8 }, style]}>
            {alerts.map(alert => {
                const open = alert.id === openId;
                const title = alert.header ?? alert.description;
                const detail = alert.header ? alert.description : null;
                return (
                    <Pressable
                        key={alert.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Service alert: ${title}`}
                        accessibilityState={{ expanded: open }}
                        onPress={() => setOpenId(open ? null : alert.id)}
                        style={{ flexDirection: 'row', gap: 10, borderRadius: RADIUS.tile, padding: 12, backgroundColor: WARNING + '22' }}
                    >
                        <CircleAlert size={18} color={WARNING} style={{ marginTop: 1 }} />
                        <View style={{ flex: 1, gap: 4 }}>
                            <Text numberOfLines={open ? undefined : 2} style={{ color: theme.color, fontSize: 14, fontWeight: '600' }}>
                                {title}
                            </Text>
                            {open && detail && <Text style={{ color: theme.color, opacity: 0.75, fontSize: 13 }}>{detail}</Text>}
                        </View>
                    </Pressable>
                );
            })}
        </View>
    );
}
