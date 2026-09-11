import { useState, type ReactNode } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useAnimatedValue,
} from 'react-native';

import { fontSize, fontWeight, space, type ColorScheme } from '@real-rex/shared';

import { useTheme } from '../theme';

/**
 * Drag a row left; Remove is behind it.
 *
 * Taking a spot off a list is the only thing on the page that is not writing,
 * and it was the last symbol left on a screen that is otherwise nothing but
 * words -- so it goes where iOS has kept it since 2007, behind the row. A
 * tap anywhere on an open row closes it rather than acting, which is both the
 * convention and the safe default for a destructive control.
 *
 * PanResponder and Animated, in React Native core, for the same reason as
 * decision 36: no gesture-handler, no reanimated, no prebuild.
 *
 * WORTH TESTING ON A DEVICE. This shares gesture space with the drag to
 * reorder that decision 36 describes. Reorder is a press-and-hold then drag,
 * this is a drag straight off -- distinguishable in principle, unproven in
 * the hand, and reorder is not wired up yet.
 */

const WIDTH = 96;
/** Past this and the row stays open on release. */
const LATCH = 44;
/** Below this a gesture is still a tap, and taps belong to the row. */
const SLOP = 6;

type Props = {
  onRemove: () => void;
  children: ReactNode;
};

export function SwipeRow({ onRemove, children }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const dx = useAnimatedValue(0);
  /**
   * Where the row is resting: 0 or -WIDTH. State rather than a ref, and it
   * costs nothing -- it only changes when a gesture ends, so no render happens
   * while a finger is down, and the gesture reads this render's value.
   */
  const [offset, setOffset] = useState(0);
  const open = offset !== 0;

  const glide = (to: number) => {
    setOffset(to);
    Animated.spring(dx, {
      toValue: to,
      useNativeDriver: true,
      friction: 9,
      tension: 70,
    }).start();
  };

  /** Built fresh each render, as in ReorderableRows: `create` only assembles
   *  an object of callbacks, and the handlers are read from props at event
   *  time, so the gesture always sees the current `onRemove`. */
  const pan = PanResponder.create({
    // Claim the gesture only once it is clearly horizontal, so a scroll stays
    // a scroll and a tap stays a tap.
    onMoveShouldSetPanResponder: (_e, g) =>
      Math.abs(g.dx) > SLOP && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: (_e, g) => {
      dx.setValue(Math.min(0, Math.max(-WIDTH, offset + g.dx)));
    },
    onPanResponderRelease: (_e, g) => glide(offset + g.dx < -LATCH ? -WIDTH : 0),
    onPanResponderTerminate: () => glide(offset),
  });

  return (
    <View style={styles.clip}>
      <View style={styles.behind}>
        <Pressable
          onPress={() => {
            glide(0);
            onRemove();
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
        >
          <Text style={styles.removeLabel}>Remove</Text>
        </Pressable>
      </View>

      <Animated.View
        {...pan.panHandlers}
        style={[styles.front, { transform: [{ translateX: dx }] }]}
      >
        {children}
        {open ? (
          <Pressable
            onPress={() => glide(0)}
            accessibilityLabel="Close"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}

const makeStyles = (theme: ColorScheme) =>
  StyleSheet.create({
    clip: { overflow: 'hidden' },
    behind: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'flex-end' },
    remove: {
      width: WIDTH,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: space.sm,
      /** No destructive role exists in the tokens yet. Ink is the strongest
       *  ground the palette has, and it is unmistakably not the page. */
      backgroundColor: theme.textPrimary,
    },
    removeLabel: {
      fontSize: fontSize.base,
      fontWeight: fontWeight.medium,
      color: theme.surface,
    },
    pressed: { opacity: 0.8 },
    front: { backgroundColor: theme.background },
  });
