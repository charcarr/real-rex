import { useState, type ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';

import { MAX_SPOTS_PER_LIST } from '@real-rex/shared';

/**
 * Drag to reorder, in React Native core only.
 *
 * No gesture-handler, no reanimated. That is not stubbornness -- it is the cap
 * doing work. A list holds at most five rows of one fixed height, so "which
 * slot is the finger over" is a division, and the whole gesture is
 * PanResponder plus one Animated.Value per slot. Those libraries earn their
 * keep on long lists with variable row heights, neither of which is true here,
 * and both are native dependencies that would need a prebuild.
 *
 * If this ever has to handle a long list, replace it rather than grow it.
 *
 * The row under the finger is translated by the gesture. Every row it has
 * passed is translated one slot the other way, which is what opens a gap ahead
 * of it and closes one behind it.
 */

type Props = {
  count: number;
  rowHeight: number;
  /** `dragging` is true for the row under the finger, so it can lift. */
  renderRow: (index: number, dragging: boolean) => ReactNode;
  onMove: (from: number, to: number) => void;
  /** Handles are only live once there is more than one row to reorder. */
  enabled?: boolean;
  /** Called on grab and release, so the screen can lock its ScrollView. */
  onDragChange?: (dragging: boolean) => void;
};

export function ReorderableRows({
  count,
  rowHeight,
  renderRow,
  onMove,
  enabled = true,
  onDragChange,
}: Props) {
  /** Which row the finger has hold of, or null. Real state, because the row
   *  has to re-render to lift. */
  const [dragging, setDragging] = useState<number | null>(null);

  /**
   * One slot's worth of displacement per row, plus the finger's own offset.
   *
   * Allocated for the maximum rather than for `count`: hooks cannot be
   * conditional, and the maximum is a fixed product constant (decision 7).
   *
   * Lazy state rather than a ref. The initialiser runs exactly once, which is
   * all a ref was wanted for, and these are read while rendering -- which the
   * compiler's rules do not allow a ref to be.
   */
  const [offsets] = useState(() =>
    Array.from({ length: MAX_SPOTS_PER_LIST }, () => new Animated.Value(0)),
  );
  const [fingerY] = useState(() => new Animated.Value(0));

  /**
   * The slot the dragged row would land in if the finger lifted now.
   *
   * A stable mutable box rather than a ref, for the same reason as above. It
   * has to survive a re-render and must never cause one -- changing it mid
   * gesture is what animates, and re-rendering on every pixel of a drag is
   * how a drag ends up janky.
   */
  const [hover] = useState(() => ({ slot: 0 }));

  /**
   * Shift every row out of the dragged row's way.
   *
   * Dragging row `from` down to `to` means every row between them moves up one
   * slot, and vice versa; rows outside that span do not move at all. Written
   * as a full recalculation rather than an increment, so it cannot drift
   * however fast the finger moves or however many swaps it crosses at once.
   */
  const settle = (from: number, to: number) => {
    for (let i = 0; i < count; i++) {
      if (i === from) continue;

      let shift = 0;
      if (from < to && i > from && i <= to) shift = -rowHeight;
      else if (from > to && i >= to && i < from) shift = rowHeight;

      const value = offsets[i];
      if (!value) continue;

      Animated.spring(value, {
        toValue: shift,
        useNativeDriver: true,
        // Firm and short. A bouncy reorder reads as a toy.
        stiffness: 260,
        damping: 26,
        mass: 0.7,
      }).start();
    }
  };

  const release = () => {
    fingerY.setValue(0);
    offsets.forEach((o) => o.setValue(0));
    setDragging(null);
    onDragChange?.(false);
  };

  /**
   * Built fresh each render, deliberately.
   *
   * PanResponder.create only assembles an object of callbacks, so this is
   * cheap, and React Native reads the handlers from props at event time. That
   * means the gesture always sees the current `count` and `onMove` -- the bug
   * a memoised responder has, where it closes over the first render's props
   * and quietly reorders against a list that has since changed.
   */
  const responderFor = (index: number) =>
    PanResponder.create({
      // Claimed on movement rather than on touch, so a tap on a row is still a
      // tap and the ScrollView keeps scrolling until the finger travels.
      onMoveShouldSetPanResponder: (_e, g) => enabled && count > 1 && Math.abs(g.dy) > 4,

      onPanResponderGrant: () => {
        hover.slot = index;
        fingerY.setValue(0);
        setDragging(index);
        onDragChange?.(true);
      },

      onPanResponderMove: (_e, g) => {
        fingerY.setValue(g.dy);

        // Rounding is what makes the swap happen as the row passes the halfway
        // point of its neighbour rather than when it has fully cleared it.
        const target = Math.max(0, Math.min(count - 1, index + Math.round(g.dy / rowHeight)));
        if (target !== hover.slot) {
          hover.slot = target;
          settle(index, target);
        }
      },

      onPanResponderRelease: () => {
        const to = hover.slot;

        // Cleared in the same tick as the reorder, so there is no frame in
        // which a row is both moved in the array and displaced by an offset.
        release();
        if (to !== index) onMove(index, to);
      },

      onPanResponderTerminate: release,
    });

  return (
    <View>
      {Array.from({ length: count }, (_, i) => {
        const isDragged = dragging === i;
        return (
          <Animated.View
            key={i}
            {...responderFor(i).panHandlers}
            style={[
              styles.row,
              { height: rowHeight },
              isDragged && styles.lifted,
              {
                transform: [
                  { translateY: isDragged ? fingerY : (offsets[i] ?? 0) },
                  { scale: isDragged ? 1.02 : 1 },
                ],
              },
            ]}
          >
            {renderRow(i, isDragged)}
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { justifyContent: 'center' },
  /** The dragged row comes off the page: above its neighbours, and shadowed,
   *  so the lift is seen rather than inferred from the movement. */
  lifted: {
    zIndex: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
});
