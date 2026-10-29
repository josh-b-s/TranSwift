import React, { useRef } from 'react';
import { TextInput } from 'react-native';
import { useThemeStyle } from '@/constants/themes';
import InputCard, { usePillStyle } from './InputCard';

type Props = {
    title: string;
    values: string[];
    onChange: (values: string[]) => void;
};

/**
 * A card with one pill input per URL. A spare empty pill always sits at the
 * end; Enter jumps to the next one, pasted lines become separate pills, and an
 * emptied pill disappears when it loses focus.
 */
export default function UrlListInput({ title, values, onChange }: Props) {
    const theme = useThemeStyle();
    const pill = usePillStyle();
    const inputs = useRef<(TextInput | null)[]>([]);
    const rows = values[values.length - 1] === '' ? values : [...values, ''];

    function handleChange(i: number, text: string) {
        const lines = text.split(/\r?\n/).map((line) => line.trim());
        onChange([...rows.slice(0, i), ...lines, ...rows.slice(i + 1)]);
    }

    function handleBlur(i: number) {
        if (rows[i] === '' && i < rows.length - 1) onChange(rows.filter((_, j) => j !== i));
    }

    return (
        <InputCard title={title}>
            {rows.map((value, i) => (
                <TextInput
                    key={i}
                    ref={(el) => { inputs.current[i] = el; }}
                    value={value}
                    onChangeText={(text) => handleChange(i, text)}
                    onBlur={() => handleBlur(i)}
                    onSubmitEditing={() => inputs.current[i + 1]?.focus()}
                    multiline
                    submitBehavior="submit"
                    returnKeyType="next"
                    placeholder={i === 0 ? 'Add a URL' : undefined}
                    placeholderTextColor={theme.color + '66'}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    style={pill}
                />
            ))}
        </InputCard>
    );
}
