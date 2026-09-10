import { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import {
  MAX_SPOTS_PER_LIST,
  fontSize,
  fontWeight,
  letterSpacing,
  radius,
  space,
  type ColorScheme,
} from '@real-rex/shared';

import {
  PLACEHOLDER_URL,
  addSpot as addTo,
  availableSpots,
  canPublish,
  moveItem as move,
  overrideItem,
  publishState,
  removeAt as remove,
  replaceAt as replaceIn,
  resolveAll,
  type List,
  type ResolvedItem,
} from '../lists';
import type { Spot } from '../spots';
import { useTheme } from '../theme';
import { NoteEditor, type NoteDraft, type NoteScope } from '../components/NoteEditor';
import { ReorderableRows } from '../components/ReorderableRows';
import { SpotPicker } from '../components/SpotPicker';

/**
 * The list builder. The list itself is the screen.
 *
 * Five rows, always. Filled ones show the spot; empty ones are drawn as empty
 * slots rather than left out, so the cap is a shape you can see before you hit
 * it -- the same job the segmented ring does on home (decision 25). The row is
 * the public page's row: green numeral, name, one line underneath, hairline
 * between. Nothing here invents a layout.
 *
 * There is no DRAFT badge. Decision 25 is explicit that a published list is
 * marked by its link being there, so the footer is the whole state display:
 * a publish button before, the link after, and the button coming back with
 * different words when there are edits the page has not seen.
 */

const monoFamily = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** Fixed, because the drag maths divides by it. */
const ROW_HEIGHT = 78;

type Props = {
  visible: boolean;
  list: List;
  library: Spot[];
  onChange: (list: List) => void;
  /** Write words to a library spot -- the default scope in the note editor. */
  onEditSpot: (spotId: string, draft: NoteDraft) => void;
  onPublish: () => void;
  onClose: () => void;
  /** Open the paste sheet, for when the library has nothing left to offer. */
  onAddPlaces: () => void;
};

export function ListBuilder({
  visible,
  list,
  library,
  onChange,
  onEditSpot,
  onPublish,
  onClose,
  onAddPlaces,
}: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  /** The slot the picker is filling. A number means swap that slot; 'new'
   *  means append to the end. */
  const [picking, setPicking] = useState<number | 'new' | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const items = resolveAll(list, library);
  const state = publishState(list, library);
  const empties = Math.max(0, MAX_SPOTS_PER_LIST - items.length);
  const ready = canPublish(list);

  const editingItem: ResolvedItem | null = editing === null ? null : (items[editing] ?? null);

  const pick = (spotId: string) => {
    onChange(
      picking === 'new' || picking === null
        ? addTo(list, spotId)
        : replaceIn(list, picking, spotId),
    );
    setPicking(null);
  };

  const saveNote = (scope: NoteScope, draft: NoteDraft) => {
    if (editing === null) return;
    const item = items[editing];
    if (!item) return;

    if (scope === 'library') {
      onEditSpot(item.spot.id, draft);
      // Anything this list was saying instead has just been answered by the
      // library, so the override is cleared rather than left to shadow it.
      onChange(clearOverride(list, editing));
    } else {
      onChange(setOverride(list, editing, draft));
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={12}>
            <Text style={styles.back}>Done</Text>
          </Pressable>
          <Text style={styles.counter}>
            {items.length}/{MAX_SPOTS_PER_LIST}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          // A drag must not also scroll the page under it.
          scrollEnabled={!dragging}
        >
          {/* The one bold element on the screen. */}
          <TextInput
            value={list.title}
            onChangeText={(title) =>
              onChange({ ...list, title, updatedAt: new Date().toISOString() })
            }
            placeholder="Name this list"
            placeholderTextColor={theme.textMuted}
            style={styles.titleInput}
            multiline
          />
          <TextInput
            value={list.description ?? ''}
            onChangeText={(description) =>
              onChange({
                ...list,
                description: description.trim() === '' ? null : description,
                updatedAt: new Date().toISOString(),
              })
            }
            placeholder="A line about it, if you like"
            placeholderTextColor={theme.textMuted}
            style={styles.descriptionInput}
            multiline
          />

          <View style={styles.slots}>
            <ReorderableRows
              count={items.length}
              rowHeight={ROW_HEIGHT}
              onMove={(from, to) => onChange(move(list, from, to))}
              onDragChange={setDragging}
              renderRow={(index, isDragging) => {
                const item = items[index];
                if (!item) return null;
                return (
                  <FilledSlot
                    theme={theme}
                    index={index}
                    item={item}
                    dragging={isDragging}
                    onPress={() => setEditing(index)}
                  />
                );
              }}
            />

            {Array.from({ length: empties }, (_, i) => (
              <EmptySlot
                key={`empty-${i}`}
                theme={theme}
                index={items.length + i}
                // Only the first empty slot is live. Filling slot 5 while 3 is
                // empty would mean storing a gap, and decision 15 says the
                // numeral is a rank -- so the row would not stay where it was
                // put and the app would look broken.
                enabled={i === 0}
                onPress={() => setPicking('new')}
              />
            ))}
          </View>

          <Text style={styles.hint}>
            {items.length > 1
              ? 'DRAG A ROW TO REORDER · TAP TO WRITE ABOUT IT'
              : 'TAP A ROW TO WRITE ABOUT IT'}
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          {list.published ? <PublishedLink theme={theme} url={list.published.url} /> : null}

          <Pressable
            onPress={onPublish}
            disabled={!ready || state === 'published'}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.publish,
              (!ready || state === 'published') && styles.publishOff,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.publishLabel,
                (!ready || state === 'published') && styles.publishLabelOff,
              ]}
            >
              {state === 'published'
                ? 'Published'
                : state === 'edited'
                  ? 'Publish changes'
                  : 'Publish'}
            </Text>
          </Pressable>

          {!ready ? (
            <Text style={styles.footerHint}>
              {list.title.trim() === '' ? 'Name your list to publish it' : 'Add at least one spot'}
            </Text>
          ) : null}
        </View>
      </SafeAreaView>

      <SpotPicker
        visible={picking !== null}
        spots={availableSpots(list, library)}
        replacing={typeof picking === 'number' ? (items[picking]?.title ?? null) : null}
        onPick={pick}
        onClose={() => setPicking(null)}
        onAddPlaces={() => {
          setPicking(null);
          onClose();
          onAddPlaces();
        }}
      />

      {/* Keyed by the spot, so opening a different row remounts the sheet and
          its draft starts from that row rather than being copied in by an
          effect a render later. */}
      {editingItem ? (
        <NoteEditor
          key={editingItem.spot.id}
          item={editingItem}
          onClose={() => setEditing(null)}
          onSave={saveNote}
          onRevert={() => editing !== null && onChange(clearOverride(list, editing))}
          onRemove={() => editing !== null && onChange(remove(list, editing))}
          onSwap={() => {
            const slot = editing;
            setEditing(null);
            if (slot !== null) setPicking(slot);
          }}
        />
      ) : null}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

function FilledSlot({
  theme,
  index,
  item,
  dragging,
  onPress,
}: {
  theme: ColorScheme;
  index: number;
  item: ResolvedItem;
  dragging: boolean;
  onPress: () => void;
}) {
  const styles = makeStyles(theme);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, slot ${index + 1}`}
      style={({ pressed }) => [
        styles.slot,
        dragging && styles.slotDragging,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.numeral}>{index + 1}</Text>

      <View style={styles.slotText}>
        <Text style={styles.slotTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text
          style={[styles.slotNote, !item.shortNote && styles.slotNoteMissing]}
          numberOfLines={1}
        >
          {item.shortNote ?? 'Add a note'}
        </Text>
      </View>

      <GripIcon color={theme.textMuted} />
    </Pressable>
  );
}

function EmptySlot({
  theme,
  index,
  enabled,
  onPress,
}: {
  theme: ColorScheme;
  index: number;
  enabled: boolean;
  onPress: () => void;
}) {
  const styles = makeStyles(theme);

  return (
    <Pressable
      onPress={enabled ? onPress : undefined}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={`Add a spot to slot ${index + 1}`}
      style={({ pressed }) => [styles.slot, styles.slotEmpty, pressed && styles.pressed]}
    >
      <Text style={[styles.numeral, styles.numeralEmpty]}>{index + 1}</Text>
      <View style={styles.slotText}>
        <Text style={[styles.slotTitle, styles.slotTitleEmpty]}>
          {enabled ? 'Add a spot' : 'Empty'}
        </Text>
      </View>
      {enabled ? <PlusIcon color={theme.accent} /> : null}
    </Pressable>
  );
}

/**
 * The link, and only after publishing -- its presence is what says the list is
 * out there (decision 25).
 *
 * The mono line under it is not decoration. Until there is a Supabase client
 * and a public page, this URL is a stand-in, and an app whose whole job is to
 * hand someone a trustworthy link does not get to be vague about that on
 * screen.
 */
function PublishedLink({ theme, url }: { theme: ColorScheme; url: string }) {
  const styles = makeStyles(theme);
  const placeholder = url === PLACEHOLDER_URL;

  return (
    <View style={styles.linkRow}>
      <View style={styles.linkText}>
        <Text style={styles.linkUrl} numberOfLines={1}>
          {url.replace(/^https?:\/\//, '')}
        </Text>
        {placeholder ? (
          <Text style={styles.linkNote}>PLACEHOLDER — NOTHING IS LIVE YET</Text>
        ) : null}
      </View>

      <Pressable
        onPress={() => {
          // Share rather than a direct clipboard write: RN core dropped
          // Clipboard, and expo-clipboard is a native dependency that would
          // need flagging and a prebuild. The share sheet has Copy in it, and
          // it is where this ends up anyway (todo.md section 6).
          void Share.share({ message: url });
        }}
        accessibilityRole="button"
        hitSlop={8}
        style={({ pressed }) => [styles.copy, pressed && styles.pressed]}
      >
        <Text style={styles.copyLabel}>Send</Text>
      </Pressable>
    </View>
  );
}

const GripIcon = ({ color }: { color: string }) => (
  <Svg
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
  >
    <Path d="M8 9h.01M8 15h.01M16 9h.01M16 15h.01" />
  </Svg>
);

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

// ---------------------------------------------------------------------------
// Small adapters between the editor's draft shape and the model.
// ---------------------------------------------------------------------------

const clearOverride = (list: List, index: number): List =>
  overrideItem(list, index, { title: null, shortNote: null, longNote: null });

const setOverride = (list: List, index: number, draft: NoteDraft): List =>
  overrideItem(list, index, {
    title: draft.title,
    shortNote: draft.shortNote,
    longNote: draft.longNote,
  });

const makeStyles = (theme: ColorScheme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.lg + 4,
      paddingTop: space.md,
      paddingBottom: space.sm,
    },
    back: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: theme.textPrimary },
    counter: {
      fontFamily: monoFamily,
      fontSize: fontSize.xs,
      letterSpacing: letterSpacing.wide,
      color: theme.textMuted,
    },

    body: { paddingHorizontal: space.lg + 4, paddingBottom: space['3xl'] },

    titleInput: {
      marginTop: space.lg,
      fontSize: fontSize['3xl'],
      lineHeight: 34,
      fontWeight: fontWeight.semibold,
      letterSpacing: letterSpacing.tightest,
      color: theme.textPrimary,
      padding: 0,
    },
    descriptionInput: {
      marginTop: space.sm,
      fontSize: fontSize.md,
      lineHeight: 21,
      color: theme.textSecondary,
      padding: 0,
    },

    slots: {
      marginTop: space.xl,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },

    slot: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.lg,
      height: ROW_HEIGHT,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.background,
    },
    /** Opaque and rounded while lifted, so the shadow has an edge to fall from
     *  and the rows underneath do not show through. */
    slotDragging: {
      backgroundColor: theme.surface,
      borderRadius: radius.md,
      borderBottomColor: 'transparent',
      paddingHorizontal: space.md,
    },
    slotEmpty: { backgroundColor: 'transparent' },

    /** Large numerals are where green is allowed on a light ground. */
    numeral: {
      width: 26,
      fontFamily: monoFamily,
      fontSize: fontSize['2xl'],
      fontWeight: fontWeight.semibold,
      color: theme.accent,
    },
    numeralEmpty: { color: theme.border },

    slotText: { flex: 1, minWidth: 0 },
    slotTitle: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.medium,
      letterSpacing: letterSpacing.tight,
      color: theme.textPrimary,
    },
    slotTitleEmpty: { color: theme.textMuted, fontWeight: fontWeight.regular },
    slotNote: { marginTop: 3, fontSize: fontSize.base, color: theme.textSecondary },
    /** A place with no words is not an error, but it will say nothing on the
     *  page, and that is better known now than after publishing. */
    slotNoteMissing: { color: theme.textMuted, fontStyle: 'italic' },

    hint: {
      marginTop: space.lg,
      fontFamily: monoFamily,
      fontSize: fontSize.xs,
      letterSpacing: letterSpacing.wide,
      color: theme.textMuted,
    },

    footer: {
      paddingHorizontal: space.lg + 4,
      paddingTop: space.md,
      paddingBottom: space.md,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.surface,
    },

    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingBottom: space.md,
    },
    linkText: { flex: 1, minWidth: 0 },
    linkUrl: { fontSize: fontSize.base, color: theme.textPrimary },
    linkNote: {
      marginTop: 2,
      fontFamily: monoFamily,
      fontSize: fontSize.xs,
      letterSpacing: letterSpacing.wide,
      color: theme.textMuted,
    },
    copy: {
      height: 36,
      justifyContent: 'center',
      paddingHorizontal: space.lg,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: theme.border,
    },
    copyLabel: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: theme.textPrimary },

    publish: {
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.full,
      backgroundColor: theme.accent,
    },
    publishOff: { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
    publishLabel: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: '#FFFFFF' },
    publishLabelOff: { color: theme.textMuted },

    footerHint: {
      marginTop: space.sm,
      textAlign: 'center',
      fontSize: fontSize.sm,
      color: theme.textMuted,
    },

    pressed: { opacity: 0.7 },
  });
