import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
  fontSize,
  fontWeight,
  letterSpacing,
  radius,
  space,
  type ColorScheme,
} from '@real-rex/shared';

import type { Spot } from '../spots';
import { useTheme } from '../theme';

/**
 * Choosing a place for a slot.
 *
 * Opens in one of two moods. Normally it is filling an empty slot, and it
 * offers everything in your library that is not already on the list. On a full
 * list it is the sixth tap from decision 25 -- adding a place is not an error
 * and not a disabled row, it is a question about which of the five it
 * replaces -- so the same sheet arrives saying what it is about to displace.
 *
 * A spot with no note is marked rather than hidden. It can go on a list; it
 * will just say nothing when it gets there, and that is worth knowing before
 * you publish rather than after.
 */

const monoFamily = Platform.select({ ios: 'Menlo', default: 'monospace' });

type Props = {
  visible: boolean;
  spots: Spot[];
  /** The name of the spot about to be replaced, when this is the sixth tap. */
  replacing?: string | null;
  onPick: (spotId: string) => void;
  onClose: () => void;
  /** The library is empty, or everything in it is already on the list. */
  onAddPlaces: () => void;
};

export function SpotPicker({ visible, spots, replacing, onPick, onClose, onAddPlaces }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          <View style={styles.header}>
            <Text style={styles.title}>{replacing ? 'Swap in' : 'Add a spot'}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" hitSlop={12}>
              <Text style={styles.done}>Cancel</Text>
            </Pressable>
          </View>

          {replacing ? (
            <Text style={styles.replacing}>
              Your list is full. Whichever you pick takes {replacing}&rsquo;s place.
            </Text>
          ) : null}

          <ScrollView contentContainerStyle={styles.list}>
            {spots.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Nothing left to add</Text>
                <Text style={styles.emptyBody}>
                  Every place in your library is already on this list. Paste a Google Maps link to
                  add another.
                </Text>
                <Pressable
                  onPress={onAddPlaces}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.emptyAction, pressed && styles.pressed]}
                >
                  <Text style={styles.emptyActionLabel}>Add places</Text>
                </Pressable>
              </View>
            ) : (
              spots.map((spot) => (
                <Pressable
                  key={spot.id}
                  onPress={() => onPick(spot.id)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {spot.title}
                    </Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {spot.shortNote ?? spot.address ?? 'No note yet'}
                    </Text>
                  </View>
                  {spot.shortNote ? null : <Text style={styles.needsNote}>NEEDS A NOTE</Text>}
                  <PlusIcon color={theme.accent} />
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const PlusIcon = ({ color }: { color: string }) => (
  <Svg
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
  >
    <Path d="M12 5v14" />
    <Path d="M5 12h14" />
  </Svg>
);

const makeStyles = (theme: ColorScheme) =>
  StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10,10,11,0.55)' },
    sheet: {
      maxHeight: '80%',
      minHeight: 320,
      backgroundColor: theme.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingTop: 10,
      paddingBottom: 20,
    },
    grabber: {
      width: 36,
      height: 4,
      borderRadius: radius.full,
      backgroundColor: theme.border,
      alignSelf: 'center',
      marginBottom: 14,
    },

    header: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: space.lg + 4,
      paddingBottom: 14,
    },
    title: {
      fontSize: fontSize.xl,
      fontWeight: fontWeight.semibold,
      letterSpacing: letterSpacing.tight,
      color: theme.textPrimary,
    },
    done: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: theme.textPrimary },

    replacing: {
      paddingHorizontal: space.lg + 4,
      paddingBottom: 14,
      fontSize: fontSize.base,
      lineHeight: 19,
      color: theme.textSecondary,
    },

    list: { paddingBottom: space.lg },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      minHeight: 68,
      paddingVertical: 14,
      paddingHorizontal: space.lg + 4,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    rowPressed: { backgroundColor: theme.background },
    rowText: { flex: 1, minWidth: 0 },
    rowTitle: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.medium,
      letterSpacing: letterSpacing.tight,
      color: theme.textPrimary,
    },
    rowSub: { marginTop: 3, fontSize: fontSize.base, color: theme.textSecondary },
    needsNote: {
      fontFamily: monoFamily,
      fontSize: fontSize.xs,
      letterSpacing: letterSpacing.wide,
      color: theme.textMuted,
    },

    empty: { paddingHorizontal: space.lg + 4, paddingTop: space.xl },
    emptyTitle: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.semibold,
      letterSpacing: letterSpacing.tight,
      color: theme.textPrimary,
    },
    emptyBody: {
      marginTop: space.sm,
      fontSize: fontSize.base,
      lineHeight: 19,
      color: theme.textSecondary,
    },
    emptyAction: {
      marginTop: space.lg,
      alignSelf: 'flex-start',
      height: 44,
      justifyContent: 'center',
      paddingHorizontal: space.xl,
      borderRadius: radius.full,
      backgroundColor: theme.accent,
    },
    emptyActionLabel: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: '#FFFFFF',
    },
    pressed: { opacity: 0.7 },
  });
