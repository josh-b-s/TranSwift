import React, { useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { ACCENT, RADIUS, SHADOW, useThemeStyle } from '@/constants/themes';

type Option<T> = { value: T; label: string };

type Props<T> = {
    options: Option<T>[];
    value: T | null;
    onChange: (value: T) => void;
    /** Draws the control that opens the list. `onPress` opens it. */
    renderTrigger: (open: { onPress: () => void }) => React.ReactNode;
};

const MENU_GAP = 6;
const MENU_MIN_WIDTH = 160;

/** A control that opens a short list under itself, over everything else, and closes on a choice or a tap outside. */
export default function Dropdown<T extends string | number>({ options, value, onChange, renderTrigger }: Props<T>) {
    const theme = useThemeStyle();
    const anchor = useRef<View>(null);
    const [box, setBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

    // Measured in window coordinates, since the list sits in a Modal and not under the control's parent.
    const open = () => anchor.current?.measureInWindow((x, y, width, height) => setBox({ x, y, width, height }));
    const close = () => setBox(null);

    return (
        <>
            <View ref={anchor} collapsable={false}>{renderTrigger({ onPress: open })}</View>
            <Modal visible={box !== null} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
                <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Close list">
                    {box && (
                        <View
                            style={[
                                {
                                    position: 'absolute', left: box.x, top: box.y + box.height + MENU_GAP,
                                    minWidth: Math.max(box.width, MENU_MIN_WIDTH),
                                    paddingVertical: 6, borderRadius: RADIUS.tile, backgroundColor: theme.backgroundColor,
                                },
                                SHADOW,
                            ]}
                        >
                            {options.map(option => {
                                const active = option.value === value;
                                return (
                                    <Pressable
                                        key={String(option.value)}
                                        accessibilityRole="menuitem"
                                        accessibilityState={{ selected: active }}
                                        onPress={() => {
                                            close();
                                            onChange(option.value);
                                        }}
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 }}
                                    >
                                        <Text style={{ flex: 1, color: active ? ACCENT : theme.color, fontSize: 15, fontWeight: active ? '700' : '500' }}>
                                            {option.label}
                                        </Text>
                                        {active && <Check size={16} color={ACCENT} />}
                                    </Pressable>
                                );
                            })}
                        </View>
                    )}
                </Pressable>
            </Modal>
        </>
    );
}
