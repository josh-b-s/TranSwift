import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import * as Haptics from 'expo-haptics';

const ITEM_H = 40;
const ROWS = 5;
const PAD = ITEM_H * Math.floor(ROWS / 2);

type Props = {
    items: string[];
    index: number;
    onChange: (index: number) => void;
    width: number;
    color: string;
};

/** A column of values that snaps to one under a highlight band, like the iOS date wheels. */
export default function WheelPicker({ items, index, onChange, width, color }: Props) {
    const scroll = useRef<ScrollView>(null);
    // The row the wheel last came to rest on, so a change from outside is told apart from the rider's own scroll.
    const settled = useRef(index);
    const ticked = useRef(index);

    const indexAt = (y: number) => Math.min(items.length - 1, Math.max(0, Math.round(y / ITEM_H)));

    useEffect(() => {
        if (index === settled.current) return;
        settled.current = index;
        scroll.current?.scrollTo({ y: index * ITEM_H, animated: false });
    }, [index]);

    function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
        const i = indexAt(e.nativeEvent.contentOffset.y);
        if (i === ticked.current) return;
        ticked.current = i;
        Haptics.selectionAsync();
    }

    function rest(e: NativeSyntheticEvent<NativeScrollEvent>) {
        const i = indexAt(e.nativeEvent.contentOffset.y);
        settled.current = i;
        if (i !== index) onChange(i);
    }

    function pick(i: number) {
        scroll.current?.scrollTo({ y: i * ITEM_H, animated: true });
        settled.current = i;
        onChange(i);
    }

    return (
        <View style={{ width, height: ITEM_H * ROWS }}>
            <View
                pointerEvents="none"
                style={{ position: 'absolute', top: PAD, left: 0, right: 0, height: ITEM_H, borderRadius: 12, backgroundColor: color + '14' }}
            />
            <ScrollView
                ref={scroll}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_H}
                decelerationRate="fast"
                scrollEventThrottle={16}
                onLayout={() => scroll.current?.scrollTo({ y: index * ITEM_H, animated: false })}
                onScroll={onScroll}
                onMomentumScrollEnd={rest}
                onScrollEndDrag={rest}
                contentContainerStyle={{ paddingVertical: PAD }}
                nestedScrollEnabled
            >
                {items.map((label, i) => (
                    <Pressable key={label + i} onPress={() => pick(i)} style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color, fontSize: 20, fontWeight: i === index ? '700' : '500', opacity: i === index ? 1 : 0.35 }}>
                            {label}
                        </Text>
                    </Pressable>
                ))}
            </ScrollView>
        </View>
    );
}
