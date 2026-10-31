import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { RADIUS, useThemeStyle } from '@/constants/themes';
import { useStationDetail } from '@/hooks/stationDetail';
import type { RepoStop } from '@/services/gtfs/core/stopRepo';
import { exitSummary, platformSubtitle, platformTitle } from '@/services/gtfs/station/stationFormat';

/** Which platform is which and how to reach each exit from this one. Hidden when the feed has nothing for the stop. */
export default function StationDetailSection({ stop }: { stop: RepoStop | null }) {
    const theme = useThemeStyle();
    const result = useStationDetail(stop);
    const [open, setOpen] = useState(false);
    React.useEffect(() => setOpen(false), [stop]);

    if (!result || result.status !== 'ok') return null;
    const { stationName, platforms, exits } = result.detail;
    const current = platforms.find(p => p.isCurrent);
    const muted = { color: theme.muted, fontSize: 12 };
    const heading = { color: theme.color, fontSize: 13, fontWeight: '700' as const };

    return (
        <View style={{ marginHorizontal: 24, marginBottom: 8, borderRadius: RADIUS.tile, padding: 14, backgroundColor: theme.backgroundColor }}>
            <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={`Station details, ${open ? 'hide' : 'show'}`}
                onPress={() => setOpen(o => !o)}
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
            >
                <View style={{ flex: 1 }}>
                    <Text style={heading}>{stationName ?? 'Station details'}</Text>
                    {current && (
                        <Text style={muted}>
                            {[platformTitle(current), platformSubtitle(current)].filter(Boolean).join(' · ')}
                        </Text>
                    )}
                </View>
                <ChevronDown size={18} color={theme.muted} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
            </Pressable>

            {open && (
                <View style={{ gap: 14, paddingTop: 12 }}>
                    {platforms.length > 1 && (
                        <View style={{ gap: 6 }}>
                            <Text style={heading}>Platforms</Text>
                            {platforms.map(p => (
                                <View key={p.stopPk}>
                                    <Text style={{ color: theme.color, fontSize: 13, fontWeight: p.isCurrent ? '700' : '400' }}>
                                        {[platformTitle(p), platformSubtitle(p)].filter(Boolean).join(' · ')}
                                        {p.isCurrent ? ' (this one)' : ''}
                                    </Text>
                                    {p.toward.length > 0 && <Text style={muted}>Towards {p.toward.join(', ')}</Text>}
                                </View>
                            ))}
                        </View>
                    )}
                    {exits.length > 0 && (
                        <View style={{ gap: 10 }}>
                            <Text style={heading}>Exits from this platform</Text>
                            {exits.map(exit => (
                                <View key={exit.name} style={{ gap: 2 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                                        <Text style={{ flex: 1, color: theme.color, fontSize: 13, fontWeight: '600' }}>{exit.name}</Text>
                                        <Text style={muted}>{exitSummary(exit)}</Text>
                                    </View>
                                    {exit.steps.map((step, i) => (
                                        <Text key={i} style={muted}>{`${i + 1}. ${step.text}`}</Text>
                                    ))}
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}
