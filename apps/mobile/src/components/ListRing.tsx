import Svg, { Circle, G } from 'react-native-svg';

import { MAX_SPOTS_PER_LIST, type ColorScheme } from '@real-rex/shared';

/**
 * The segmented ring. Five arcs, filled as the list fills (decision 25).
 *
 * It stands where the numeral stands on the public page's row, so the home
 * screen is the same row with the count in place of the rank. A full list
 * closes into a complete emerald circle, which is how the product's one rule
 * gets stated without a sentence anywhere saying it.
 *
 * Drawn as five dashed circles rather than five arc paths: one dash of the
 * right length, offset a fifth of the way round for each segment, is far less
 * arithmetic than five sets of arc endpoints and cannot drift out of true.
 */

type Props = {
  filled: number;
  theme: ColorScheme;
  size?: number;
};

export function ListRing({ filled, theme, size = 34 }: Props) {
  const stroke = 3;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  const step = circumference / MAX_SPOTS_PER_LIST;
  /** The visual break between segments. Small enough that a full ring reads as
   *  a circle rather than as five things. */
  const gap = 3.5;
  const segment = step - gap;

  return (
    <Svg width={size} height={size}>
      {/* -90 puts the first segment at the top, where a count should start. */}
      <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
        {Array.from({ length: MAX_SPOTS_PER_LIST }, (_, i) => (
          <Circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={i < filled ? theme.accent : theme.border}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${segment} ${circumference - segment}`}
            strokeDashoffset={-(i * step + gap / 2)}
          />
        ))}
      </G>
    </Svg>
  );
}
