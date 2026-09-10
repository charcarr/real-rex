import Svg, { G, Path } from 'react-native-svg';

import { realRexMark } from '@real-rex/shared';

type Props = {
  /** Width in points. Height follows the mark's aspect ratio. */
  size: number;
  color: string;
};

/** Aspect ratio of the drawing, so callers only ever pass a width. */
const [, , markWidth, markHeight] = realRexMark.viewBox.split(' ').map(Number);

export function RealRexMark({ size, color }: Props) {
  return (
    <Svg
      width={size}
      height={(size * markHeight) / markWidth}
      viewBox={realRexMark.viewBox}
      // The mark is decorative here; the headline next to it carries the name.
      accessibilityRole="image"
      accessibilityLabel="Real Rex"
    >
      <G transform={realRexMark.transform} fill={color}>
        {realRexMark.paths.map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </G>
    </Svg>
  );
}
