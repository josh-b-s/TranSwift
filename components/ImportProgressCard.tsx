import React from 'react';
import { Text, View } from 'react-native';
import { useThemeStyle } from '@/constants/themes';
import ProgressBar from '@/components/ProgressBar';
import { formatEta, type ImportProgress } from '@/services/gtfs/import/importProgress';

type Props = {
    fileName: string;
    progress: ImportProgress;
};

export default function ImportProgressCard({ fileName, progress }: Props) {
    const theme = useThemeStyle();
    const eta = formatEta(progress.etaSeconds);

    return (
        <View style={{ padding: 16, borderRadius: 16, backgroundColor: theme.backgroundColor, gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <Text numberOfLines={1} style={{ color: theme.color, fontSize: 15, fontWeight: '600', flex: 1 }}>
                    {fileName}
                </Text>
                <Text style={{ color: theme.color, fontSize: 15, fontWeight: '700' }}>
                    {Math.floor(progress.fraction * 100)}%
                </Text>
            </View>

            <ProgressBar fraction={progress.fraction} color="#2563eb" trackColor={theme.color + '1f'} />

            <View style={{ gap: 2 }}>
                <Text style={{ color: theme.color, fontSize: 13 }}>{progress.label}</Text>
                {!!progress.detail && (
                    <Text style={{ color: theme.color, opacity: 0.5, fontSize: 12 }}>{progress.detail}</Text>
                )}
                {!!eta && <Text style={{ color: theme.color, opacity: 0.5, fontSize: 12 }}>{eta}</Text>}
            </View>
        </View>
    );
}
