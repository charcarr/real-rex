import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, useAnimatedValue, View } from 'react-native';

import { fontSize, fontWeight, letterSpacing, space, type ColorScheme } from '@real-rex/shared';

import { useTheme } from '../theme';
import { RealRexMark } from './RealRexMark';

/**
 * The brand line, once per cold launch.
 *
 * The native splash covers the boot gap with the same mark, at the same size,
 * in the same place on the same ground, so the handover into this is invisible
 * — nothing appears, nothing moves. Then the two lines arrive, hold, and the
 * whole thing fades out over home.
 *
 * An earlier version walked the rex across to his position on home. It read as
 * a flash rather than as continuity: the mark, the ground under it and the
 * screen behind were all fading on their own clocks, and no amount of easing
 * hides three things disagreeing. One thing fading is calmer than three moving.
 *
 * The line is used once — here, the store listing, and the page footer — and
 * never repeated in-product.
 *
 * A Modal rather than an absolutely-positioned sibling of the navigator: an
 * overlay's position depends on whatever the parent happens to be, and twice
 * that put the rex in flow underneath the screen instead of over it. A Modal
 * owns its own window.
 *
 * That window takes a frame or two to come up, so the native splash is held
 * until `onShow` rather than hidden on mount. Hiding it on mount uncovered the
 * root view before this had drawn anything — a white screen, then the rex
 * appearing out of nowhere.
 */

/** How far each line travels up as it arrives. */
const RISE = 16;

/**
 * How far the rex lifts to make room for the lines.
 *
 * He starts on the true centre of the window, because that is where the native
 * splash puts him and the handover has to be invisible. Centring him there and
 * leaving him there put the whole group — mark plus two lines — low on the
 * screen. So he arrives correct and then moves: by the time he lifts, the
 * native splash is already gone and there is nothing left to stay in step with.
 *
 * 60 is roughly what it takes to centre the finished group, plus a little for
 * optical centre, which sits above the true one.
 */
const LIFT = 60;

/**
 * Width of the mark, in points. This has to equal `imageWidth` on the
 * expo-splash-screen plugin in app.json, and the mark below has to sit where
 * the native splash centres its image, or the rex jumps on handover.
 */
const MARK = 88;

/** The mark's aspect ratio, so we know how far below its centre the lines go. */
const MARK_HEIGHT = (MARK * 1472) / 1686;

type Props = { visible: boolean; onDone: () => void };

export function Splash({ visible, onDone }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const first = useAnimatedValue(0);
  const second = useAnimatedValue(0);
  const out = useAnimatedValue(0);
  const lift = useAnimatedValue(0);
  const [shown, setShown] = useState(false);

  /** The modal window is up and drawn: safe to uncover it. */
  const handleShow = useCallback(() => {
    SplashScreen.hideAsync();
    setShown(true);
  }, []);

  useEffect(() => {
    if (!visible || !shown) return;

    // Staggered rather than simultaneous: the second line is the turn, and it
    // only lands if the first one got there first.
    const reveal = (value: Animated.Value, delay: number) =>
      Animated.timing(value, {
        toValue: 1,
        duration: 520,
        delay,
        useNativeDriver: true,
      });

    // Leads the first line slightly and settles under the second, so the text
    // lands in room that is already there rather than shoving him out of it.
    const rise = Animated.timing(lift, {
      toValue: 1,
      duration: 620,
      delay: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    const sequence = Animated.sequence([
      Animated.parallel([rise, reveal(first, 220), reveal(second, 640)]),
      Animated.delay(900),
      Animated.timing(out, {
        toValue: 1,
        duration: 520,
        useNativeDriver: true,
      }),
    ]);

    sequence.start(({ finished }) => {
      if (finished) onDone();
    });
    return () => sequence.stop();
  }, [visible, shown, first, second, out, lift, onDone]);

  const lineStyle = (value: Animated.Value) => ({
    opacity: value,
    transform: [
      {
        translateY: value.interpolate({
          inputRange: [0, 1],
          outputRange: [RISE, 0],
        }),
      },
    ],
  });

  const range = (from: number, to: number) =>
    out.interpolate({ inputRange: [0, 1], outputRange: [from, to] });

  return (
    <Modal visible={visible} animationType="none" statusBarTranslucent onShow={handleShow}>
      {/* The ground stays put and only fades at the very end, so the rex is
          never travelling across a blank screen. */}
      <Animated.View style={[styles.fill, { opacity: range(1, 0) }]} pointerEvents="none">
        <View style={styles.centre}>
          {/* The only child in flow, so it lands on the true centre of the
              window — exactly where the native splash puts its image. */}
          <Animated.View
            style={{
              transform: [
                {
                  translateY: lift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -LIFT],
                  }),
                },
              ],
            }}
          >
            <RealRexMark size={MARK} color={theme.brandMark} />
          </Animated.View>

          {/* Out of flow, so the lines arriving can't shift the rex. */}
          <View style={styles.lines}>
            <Animated.Text style={[styles.line, lineStyle(first)]}>
              Recommend your best.
            </Animated.Text>
            <Animated.Text style={[styles.line, lineStyle(second)]}>Forget the rest.</Animated.Text>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const makeStyles = (theme: ColorScheme) =>
  StyleSheet.create({
    /** The Modal supplies the window; this just fills it. */
    fill: { flex: 1, backgroundColor: theme.background },
    centre: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: space.xl,
    },
    lines: {
      position: 'absolute',
      top: '50%',
      left: 0,
      right: 0,
      paddingTop: MARK_HEIGHT / 2 - LIFT + space['2xl'],
      paddingHorizontal: space.xl,
      alignItems: 'center',
    },
    line: {
      fontSize: fontSize['3xl'],
      fontWeight: fontWeight.semibold,
      letterSpacing: letterSpacing.tightest,
      color: theme.textPrimary,
      lineHeight: 35,
      textAlign: 'center',
    },
  });
