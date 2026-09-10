import { useEffect, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  fontSize,
  fontWeight,
  letterSpacing,
  radius,
  space,
  type ColorScheme,
} from '@real-rex/shared';

import type { ResolvedItem } from '../lists';
import { useTheme } from '../theme';

/**
 * Writing the words. The editing pass decision 21 promised.
 *
 * Two fields, because the public page has two: one line under the name, and a
 * paragraph behind a disclosure. Nothing here is required -- a place with no
 * words still publishes, it just says less.
 *
 * WHERE THE WORDS GO. By default, into your library, where every list that
 * uses this place picks them up: you should write "the garlic prawns" once.
 * The escape hatch is per-list words, for when the same place needs a
 * different sentence on "Lisbon for my parents" than on "Lisbon for a stag
 * do". Which one you are editing is stated on the screen rather than implied,
 * because silently editing five lists at once is the kind of thing an app
 * gets one chance to do to someone.
 */

const monoFamily = Platform.select({ ios: 'Menlo', default: 'monospace' });

/**
 * The one line is one line on the page. Cap it here rather than letting the
 * page decide with an ellipsis, so what you type is what your friend reads.
 */
export const SHORT_NOTE_MAX = 80;

export type NoteScope = 'library' | 'list';

export type NoteDraft = { title: string; shortNote: string; longNote: string };

type Props = {
  /**
   * The row being edited, already resolved against the library.
   *
   * Never null: the parent renders this only when a row is open, and keys it
   * by the spot, so opening a different row is a remount. That is what lets
   * the draft below be plain initial state instead of an effect that copies
   * props into state on every change -- which is a cascading render and, when
   * the effect is one line out of date, an editor showing the last row's
   * words.
   */
  item: ResolvedItem;
  onClose: () => void;
  onSave: (scope: NoteScope, draft: NoteDraft) => void;
  /** Drop this list's own words and go back to the library's. */
  onRevert: () => void;
  /** Take the place off this list. The library keeps it. */
  onRemove: () => void;
  /** Put a different place in this slot -- the answer to the sixth tap on a
   *  full list (decision 25). */
  onSwap: () => void;
};

export function NoteEditor({ item, onClose, onSave, onRevert, onRemove, onSwap }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const overridden = item.overridden.title || item.overridden.shortNote || item.overridden.longNote;

  /** Seeded from whatever the row currently resolves to, and opened in the
   *  scope the row is already in -- an overridden row is editing its own
   *  words, so that is what the sheet should say it is doing. */
  const [draft, setDraft] = useState<NoteDraft>(() => ({
    title: item.title,
    shortNote: item.shortNote ?? '',
    longNote: item.longNote ?? '',
  }));
  const [scope, setScope] = useState<NoteScope>(overridden ? 'list' : 'library');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Same measured-keyboard approach as the add-spots sheet: inside a Modal,
  // KeyboardAvoidingView measures against the wrong frame.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const shown = Keyboard.addListener(showEvent, (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const hidden = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  const save = () => {
    onSave(scope, draft);
    onClose();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingBottom: keyboardHeight }]}>
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {item.spot.title}
            </Text>
            <Pressable onPress={save} accessibilityRole="button" hitSlop={12}>
              <Text style={styles.done}>Done</Text>
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            <Text style={styles.label}>NAME</Text>
            <TextInput
              value={draft.title}
              onChangeText={(title) => setDraft((d) => ({ ...d, title }))}
              style={styles.field}
              placeholder="What to call it"
              placeholderTextColor={theme.textMuted}
              returnKeyType="next"
            />

            <View style={styles.labelRow}>
              <Text style={styles.label}>THE ONE LINE</Text>
              <Text style={styles.count}>
                {draft.shortNote.length}/{SHORT_NOTE_MAX}
              </Text>
            </View>
            <TextInput
              value={draft.shortNote}
              onChangeText={(shortNote) => setDraft((d) => ({ ...d, shortNote }))}
              style={styles.field}
              placeholder="Why this place, in one breath"
              placeholderTextColor={theme.textMuted}
              maxLength={SHORT_NOTE_MAX}
            />
            <Text style={styles.help}>This is what your friend reads under the name.</Text>

            <Text style={[styles.label, styles.labelSpaced]}>MORE, IF YOU WANT</Text>
            <TextInput
              value={draft.longNote}
              onChangeText={(longNote) => setDraft((d) => ({ ...d, longNote }))}
              style={[styles.field, styles.fieldTall]}
              placeholder="What to order, when to go, what to avoid"
              placeholderTextColor={theme.textMuted}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.help}>Hidden on the page until they tap the name.</Text>

            {/* Which words these are. Stated, never implied. */}
            <View style={styles.scopeCard}>
              <Text style={styles.scopeTitle}>
                {scope === 'library' ? 'Saved to your library' : 'Only on this list'}
              </Text>
              <Text style={styles.scopeBody}>
                {scope === 'library'
                  ? 'Every list with this place uses these words, unless that list says otherwise.'
                  : 'Your library keeps its own words for this place. Other lists are untouched.'}
              </Text>

              {scope === 'library' ? (
                <Pressable
                  onPress={() => setScope('list')}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={({ pressed }) => [styles.scopeAction, pressed && styles.pressed]}
                >
                  <Text style={styles.scopeActionLabel}>Write different words for this list</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => {
                    onRevert();
                    onClose();
                  }}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={({ pressed }) => [styles.scopeAction, pressed && styles.pressed]}
                >
                  <Text style={styles.scopeActionLabel}>
                    {overridden ? 'Use my library words instead' : 'Save to my library instead'}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* The row's other two verbs. Down here because they are about
                the slot rather than the words, and because a destructive
                action should not sit next to a text field. */}
            <View style={styles.rowActions}>
              <Pressable
                onPress={() => {
                  onSwap();
                  onClose();
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}
              >
                <Text style={styles.rowActionLabel}>Put a different place in this slot</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  onRemove();
                  onClose();
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}
              >
                <Text style={[styles.rowActionLabel, styles.rowActionRemove]}>
                  Remove from this list
                </Text>
              </Pressable>
              <Text style={styles.help}>Your library keeps the place either way.</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (theme: ColorScheme) =>
  StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10,10,11,0.55)' },
    sheet: {
      maxHeight: '88%',
      backgroundColor: theme.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingTop: 10,
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
      gap: space.lg,
      paddingHorizontal: space.lg + 4,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: {
      flex: 1,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.semibold,
      letterSpacing: letterSpacing.tight,
      color: theme.textPrimary,
    },
    done: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: theme.textPrimary },

    body: { padding: space.lg + 4, paddingBottom: space['3xl'] },

    labelRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginTop: space.xl,
    },
    label: {
      fontFamily: monoFamily,
      fontSize: fontSize.xs,
      letterSpacing: letterSpacing.wide,
      color: theme.textMuted,
      marginBottom: space.sm,
    },
    labelSpaced: { marginTop: space.xl },
    count: { fontFamily: monoFamily, fontSize: fontSize.xs, color: theme.textMuted },

    field: {
      minHeight: 48,
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      fontSize: fontSize.md,
      color: theme.textPrimary,
    },
    fieldTall: { minHeight: 108 },

    help: { marginTop: space.sm, fontSize: fontSize.sm, color: theme.textMuted },

    scopeCard: {
      marginTop: space['2xl'],
      padding: space.lg,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.lg,
      backgroundColor: theme.background,
    },
    scopeTitle: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      letterSpacing: letterSpacing.tight,
      color: theme.textPrimary,
    },
    scopeBody: {
      marginTop: space.xs,
      fontSize: fontSize.base,
      lineHeight: 19,
      color: theme.textSecondary,
    },
    scopeAction: { marginTop: space.md },
    /** Green on small text is only allowed as accentText, and only at this
     *  weight -- see the contrast rule in tokens.ts. */
    scopeActionLabel: {
      fontSize: fontSize.base,
      fontWeight: fontWeight.semibold,
      color: theme.accentText,
    },
    pressed: { opacity: 0.6 },

    rowActions: {
      marginTop: space['2xl'],
      paddingTop: space.lg,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    rowAction: { paddingVertical: space.md },
    rowActionLabel: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.medium,
      color: theme.textPrimary,
    },
    /** The one destructive action in the app so far. Named, not coloured red:
     *  the palette has no red and this does not delete anything. */
    rowActionRemove: { color: theme.textSecondary },
  });
