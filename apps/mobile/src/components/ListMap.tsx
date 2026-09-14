import { useEffect } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useAnimatedValue,
} from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import {
  MAX_SPOTS_PER_LIST,
  fontSize,
  letterSpacing,
  radius,
  space,
  type ColorScheme,
} from '@real-rex/shared';

import { useTheme } from '../theme';

/**
 * The map under the headline, once a list says where it is.
 *
 * PLACEHOLDER, AND HONEST ABOUT IT. The streets below are drawn, not
 * surveyed. The real version is a static snapshot of the list's own
 * coordinates, and per `docs/status.md` it wants to be MapKit's snapshotter on
 * the device rather than a tile API, because that is the one part of the
 * pipeline that is not free at volume. What this settles now is the shape: how
 * tall it is, where it sits, and what happens as the list fills.
 *
 * With nothing on the list it holds a single pin for the place. With spots it
 * holds a pin each, dropping in one after another -- the list filling up,
 * said a second way.
 */

const monoFamily = Platform.select({ ios: 'Menlo', default: 'monospace' });

const HEIGHT = 118;
const WIDTH = 350;
const PIN = 22;

/** Fixed, so the same list draws the same map every time it is opened. */
const SPOTS: readonly (readonly [number, number])[] = [
  [64, 52],
  [128, 86],
  [198, 44],
  [252, 92],
  [306, 60],
];

type Props = {
  place: string;
  /** How many spots are on the list. Zero draws the place itself. */
  count: number;
  /** Tap the words to change the words. Only the label, not the map: a real
   *  map will want its own surface back one day. */
  onPressPlace?: () => void;
};

export function ListMap({ place, count, onPressPlace }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const pins =
    count === 0
      ? [{ x: WIDTH / 2, y: HEIGHT * 0.62, size: PIN + 6 }]
      : SPOTS.slice(0, Math.min(count, MAX_SPOTS_PER_LIST)).map(([x, y]) => ({
          x,
          y,
          size: PIN,
        }));

  return (
    <View style={styles.frame}>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={theme.background} />
        <Path
          d="M-10 90 C 60 72, 96 94, 150 82 S 260 50, 360 64"
          fill="none"
          stroke={theme.border}
          strokeWidth={16}
          strokeLinecap="round"
        />
        <G stroke={theme.surface} fill="none">
          <Path d="M74 -10 L 58 128" strokeWidth={7} />
          <Path d="M212 -10 L 236 128" strokeWidth={7} />
          <Path d="M-10 39 L 360 29" strokeWidth={5} />
          <Path d="M-10 65 L 360 59" strokeWidth={3.5} />
          <Path d="M140 -10 L 132 128" strokeWidth={3.5} />
          <Path d="M292 -10 L 300 128" strokeWidth={3.5} />
        </G>
        <G fill={theme.accent} opacity={0.1}>
          <Rect x={152} y={4} width={56} height={29} rx={6} />
          <Rect x={16} y={45} width={34} height={22} rx={5} />
        </G>
      </Svg>

      {pins.map((pin, i) => (
        <Pin
          key={`${pin.x}-${pin.y}`}
          left={`${(pin.x / WIDTH) * 100}%`}
          top={`${(pin.y / HEIGHT) * 100}%`}
          size={pin.size}
          delay={i * 70}
          color={theme.accent}
          dot={theme.surface}
        />
      ))}

      <Pressable
        onPress={onPressPlace}
        disabled={!onPressPlace}
        accessibilityRole={onPressPlace ? 'button' : undefined}
        accessibilityLabel={onPressPlace ? `Location, ${place}` : undefined}
        hitSlop={8}
        style={({ pressed }) => [styles.label, pressed && styles.labelPressed]}
      >
        <Text style={styles.labelText} numberOfLines={1}>
          {place.toUpperCase()}
        </Text>
      </Pressable>
    </View>
  );
}

/** Each pin falls the last few points into place, a beat after the one before
 *  it. The stagger is the whole effect; without it five pins just appear. */
function Pin({
  left,
  top,
  size,
  delay,
  color,
  dot,
}: {
  left: `${number}%`;
  top: `${number}%`;
  size: number;
  delay: number;
  color: string;
  dot: string;
}) {
  const drop = useAnimatedValue(0);

  useEffect(() => {
    Animated.timing(drop, {
      toValue: 1,
      duration: 440,
      delay,
      useNativeDriver: true,
    }).start();
  }, [drop, delay]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left,
        top,
        marginLeft: -size / 2,
        marginTop: -size,
        opacity: drop,
        transform: [{ translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-9, 0] }) }],
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M12 23s7.5-8.1 7.5-13A7.5 7.5 0 0 0 4.5 10c0 4.9 7.5 13 7.5 13z" fill={color} />
        <Circle cx={12} cy={9.8} r={2.7} fill={dot} />
      </Svg>
    </Animated.View>
  );
}

const makeStyles = (theme: ColorScheme) =>
  StyleSheet.create({
    frame: {
      marginTop: space.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    label: {
      position: 'absolute',
      left: space.sm + 2,
      bottom: 9,
      maxWidth: '70%',
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: radius.full,
      backgroundColor: theme.surface,
    },
    labelPressed: { opacity: 0.5 },
    labelText: {
      fontFamily: monoFamily,
      fontSize: fontSize.xs,
      letterSpacing: letterSpacing.wide,
      color: theme.textSecondary,
    },
  });
