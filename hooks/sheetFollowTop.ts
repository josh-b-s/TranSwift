import { useWindowDimensions } from 'react-native';
import { clamp, SharedValue, useDerivedValue } from 'react-native-reanimated';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

/**
 * Top offset for floating map controls that ride on the bottom sheet's edge.
 * Same clamp() as the "don't go above half the screen" cap on the way up,
 * mirrored on the way down so a control can't sink lower than just above
 * the navbar.
 */
export function useSheetFollowTop(animatedPosition: SharedValue<number>) {
    const { height } = useWindowDimensions();
    const tabBarHeight = useBottomTabBarHeight();

    return useDerivedValue(() => clamp(animatedPosition.value, height / 2, height - tabBarHeight));
}
