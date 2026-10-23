import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useBottomSheetGestureHandlers } from '@gorhom/bottom-sheet';

/** Drags the sheet from anywhere inside it, same as the handle does. */
export default function SheetDragZone({ children }: { children: React.ReactNode }) {
    const { handlePanGestureHandler } = useBottomSheetGestureHandlers();

    const pan = useMemo(
        () => Gesture.Pan()
            .shouldCancelWhenOutside(false)
            .runOnJS(false)
            .onStart(handlePanGestureHandler.handleOnStart)
            .onChange(handlePanGestureHandler.handleOnChange)
            .onEnd(handlePanGestureHandler.handleOnEnd)
            .onFinalize(handlePanGestureHandler.handleOnFinalize),
        [handlePanGestureHandler],
    );

    return (
        <GestureDetector gesture={pan}>
            <View collapsable={false}>{children}</View>
        </GestureDetector>
    );
}
