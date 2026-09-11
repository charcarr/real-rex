import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

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
 * Choosing a place for the next slot.
 *
 * The sheet is where the library pays off, so it says so: a place you have
 * already written about shows its own words and a filled pin, and goes onto
 * the list finished. A place with nothing written shows a hollow pin and its
 * address, and will be asked about once it is on.
 *
 * There is no swapping. Taking a spot off and adding another is the same two
 * taps and one fewer idea to hold.
 */

type Props = {
  visible: boolean;
  spots: Spot[];
  onPick: (spotId: string) => void;
  onClose: () => void;
  /** The library is empty, or everything in it is already on the list. */
  onAddPlaces: () => void;
};

export function SpotPicker({ visible, spots, onPick, onClose, onAddPlaces }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismiss} onPress={onClose} accessibilityLabel="Close" />

        <View style={styles.sheet}>
          <View style={styles.grabber} />

          <Text style={styles.title}>Add a spot</Text>
          <Text style={styles.sub}>Ones you have written about come with their words.</Text>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
            {spots.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Nothing left to add</Text>
                <Text style={styles.emptyBody}>
                  Every place you have saved is already on this list.
                </Text>
              </View>
            ) : (
              spots.map((spot) => {
                const written = Boolean(spot.shortNote ?? spot.longNote);
                return (
                  <Pressable
                    key={spot.id}
                    onPress={() => onPick(spot.id)}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  >
                    <Svg width={18} height={18} viewBox="0 0 24 24" style={styles.pin}>
                      <Path
                        d="M12 23s7.5-8.1 7.5-13A7.5 7.5 0 0 0 4.5 10c0 4.9 7.5 13 7.5 13z"
                        fill={written ? theme.accent : theme.border}
                      />
                      <Circle cx={12} cy={9.8} r={2.7} fill={theme.surface} />
                    </Svg>

                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {spot.title}
                      </Text>
                      <Text
                        style={[styles.rowSub, !written && styles.rowSubQuiet]}
                        numberOfLines={2}
                      >
                        {spot.shortNote ?? spot.address ?? 'Nothing written yet'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <Pressable
            onPress={onAddPlaces}
            accessibilityRole="button"
            style={({ pressed }) => [styles.paste, pressed && styles.pressed]}
          >
            <Svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke={theme.accentText}
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <Path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </Svg>
            <Text style={styles.pasteLabel}>Paste a Google Maps link</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (theme: ColorScheme) =>
  StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10, 10, 11, 0.28)' },
    dismiss: { flex: 1 },
    pressed: { opacity: 0.5 },

    sheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: radius.xl + 4,
      borderTopRightRadius: radius.xl + 4,
      paddingHorizontal: space.lg + 4,
      paddingTop: space.sm + 2,
      paddingBottom: space.xl,
      maxHeight: '82%',
    },
    grabber: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      alignSelf: 'center',
      marginBottom: space.md + 2,
    },

    title: {
      fontSize: fontSize.xl,
      fontWeight: fontWeight.semibold,
      letterSpacing: letterSpacing.tight,
      color: theme.textPrimary,
    },
    sub: { marginTop: space.xs, fontSize: fontSize.base, color: theme.textSecondary },

    scroll: { marginTop: space.md - 2 },
    list: { paddingBottom: space.sm },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.md,
      minHeight: 60,
      paddingVertical: space.md - 2,
      borderBottomWidth: 1,
      borderBottomColor: theme.background,
    },
    pin: { marginTop: 3 },
    rowText: { flex: 1, minWidth: 0 },
    rowTitle: {
      fontSize: fontSize.md + 1,
      fontWeight: fontWeight.medium,
      color: theme.textPrimary,
    },
    rowSub: { marginTop: 2, fontSize: fontSize.sm, lineHeight: 16, color: theme.textSecondary },
    rowSubQuiet: { color: theme.textMuted },

    empty: { paddingVertical: space['2xl'], alignItems: 'center' },
    emptyTitle: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: theme.textPrimary },
    emptyBody: {
      marginTop: space.xs,
      fontSize: fontSize.base,
      color: theme.textSecondary,
      textAlign: 'center',
    },

    paste: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 11,
      height: 52,
      marginTop: space.md + 2,
      borderRadius: radius.full,
      borderWidth: 2,
      borderColor: theme.accent,
    },
    pasteLabel: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.medium,
      color: theme.accentText,
    },
  });
