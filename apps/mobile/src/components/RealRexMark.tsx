import Svg, { G, Path } from 'react-native-svg';

import { realRexMark } from '@real-rex/shared';

type Props = {
  /** Width in points. Height follows the mark's aspect ratio. */
  size: number;
  color: string;
};

export function RealRexMark({ size, color }: Props) {
  return (
    <Svg
      width={size}
      height={(size * realRexMark.height) / realRexMark.width}
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
