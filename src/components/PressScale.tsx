// Pressable that springs down a touch while held. Runs on the UI thread.
import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const PRESS_SPRING = { damping: 14, stiffness: 420, mass: 0.6 } as const;

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Scale while held. 1 disables the scale. */
  scaleTo?: number;
  /** Opacity while held. */
  dimTo?: number;
};

export function PressScale({ style, children, scaleTo = 0.97, dimTo = 1, onPressIn, onPressOut, disabled, ...rest }: Props) {
  const pressed = useSharedValue(0);
  const anim = useAnimatedStyle(() => ({
    opacity: 1 - (1 - dimTo) * pressed.value,
    transform: [{ scale: 1 - (1 - scaleTo) * pressed.value }],
  }));
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        pressed.value = withSpring(1, PRESS_SPRING);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = withSpring(0, PRESS_SPRING);
        onPressOut?.(e);
      }}
      style={[style, anim]}
    >
      {children}
    </AnimatedPressable>
  );
}
