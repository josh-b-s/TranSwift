import React, { useRef } from 'react';
import { TextInput, View } from 'react-native';
import { useThemeStyle } from '@/constants/themes';

type Props = {
    values: string[];
    onChange: (values: string[]) => void;
    placeholder: string;
};

/**
 * One text box per URL. A spare empty box always sits at the end; Enter jumps
 * to the next box, pasted lines become separate boxes, and an emptied box
 * disappears when it loses focus.
 */
export default function UrlListInput({ values, onChange, placeholder }: Props) {
    const theme = useThemeStyle();
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
        <View style={{ gap: 8 }}>
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
                    placeholder={i === 0 ? placeholder : 'Add another URL'}
                    placeholderTextColor={theme.color + '66'}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    style={{ color: theme.color, fontSize: 14, borderBottomWidth: 1, borderBottomColor: theme.color + '33', paddingVertical: 2 }}
                />
            ))}
        </View>
    );
}
