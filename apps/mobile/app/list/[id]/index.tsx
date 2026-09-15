import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

import { AddSpotsSheet } from '../../../src/components/AddSpotsSheet';
import { ListMap } from '../../../src/components/ListMap';
import { ListRing } from '../../../src/components/ListRing';
import { SpotPicker } from '../../../src/components/SpotPicker';
import { SwipeRow } from '../../../src/components/SwipeRow';
import {
  addSpot,
  availableSpots,
  publishState,
  removeAt,
  resolveAll,
  type ResolvedItem,
} from '../../../src/lists';
import { useStore } from '../../../src/store';
import { useTheme } from '../../../src/theme';

/**
 * The list.
 *
 * Nothing on this page is a field, so nothing on it has to look like one.
 * Numeral, name, the line underneath, a hairline between. Reading happens
 * here; writing happens on a page of its own. That division is the whole
 * design -- it is what lets this screen be quiet.
 *
 * There is no publish button and no link. Sending is a separate concern and a
 * later one; until a list can be made and kept comfortably there is nothing
 * worth sending.
 */

const monoFamily = Platform.select({ ios: 'Menlo', default: 'monospace' });

export default function ListRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { spots, listById, updateList, capture, locating } = useStore();
  const theme = useTheme();
  const styles = makeStyles(theme);

  const list = listById(id);

  const [openRow, setOpenRow] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [pasting, setPasting] = useState(false);

  // A list can go away underneath this screen -- there is no storage yet, so a
  // reload empties everything. Falling back to home beats rendering a ghost.
  if (!list) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Back onPress={() => router.replace('/')} theme={theme} styles={styles} />
        </View>
        <View style={styles.gone}>
          <Text style={styles.goneText}>This list is no longer here.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const items = resolveAll(list, spots);
  const empties = Math.max(0, MAX_SPOTS_PER_LIST - items.length);

  const edit = (step: 1 | 2) =>
    router.push({ pathname: '/list/[id]/edit', params: { id: list.id, step } });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Back onPress={() => router.back()} theme={theme} styles={styles} label="Lists" />
        <ListRing filled={items.length} theme={theme} size={26} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* Tap the words to change the words -- the rule the spot rows run on.
            The headline is also the only door to the location question for a
            list that has none, since without a place there is no map to tap. */}
        <Pressable
          onPress={() => edit(1)}
          accessibilityRole="button"
          accessibilityLabel={`Edit list name, ${list.title}`}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.headline}>
            {list.title.trim() === '' ? 'Untitled list' : list.title}
          </Text>
        </Pressable>

        {/* A statement, not a control (decision 45). Neutral rather than
            amber -- 25 says no palette expansion, and green would read as good
            news. Acting on it happens in the sheet, on home; this page still
            does nothing but hold the list. */}
        {publishState(list, spots) === 'edited' ? (
          <View style={styles.markRow}>
            <View style={styles.dot} />
            <Text style={styles.mark}>Edits not yet published</Text>
          </View>
        ) : null}

        {list.place ? (
          <ListMap place={list.place} count={items.length} onPressPlace={() => edit(2)} />
        ) : null}

        <View style={styles.rows}>
          {items.map((item, index) => (
            <SwipeRow
              key={item.spot.id}
              onRemove={() => {
                setOpenRow(null);
                updateList(removeAt(list, index));
              }}
            >
              <FilledRow
                item={item}
                index={index}
                expanded={openRow === index}
                onToggle={() => setOpenRow(openRow === index ? null : index)}
                onEdit={(step) =>
                  router.push({
                    pathname: '/list/[id]/spot/[index]',
                    params: { id: list.id, index, ...(step === 2 ? { step: '2' } : {}) },
                  })
                }
                theme={theme}
                styles={styles}
              />
            </SwipeRow>
          ))}

          {Array.from({ length: empties }, (_, i) => (
            <EmptyRow
              key={`empty-${i}`}
              index={items.length + i}
              // Only the next one up is live. Filling slot five while three is
              // empty would mean storing a gap, and decision 15 says the
              // numeral is a rank -- the row would not stay where it was put.
              live={i === 0}
              onPress={() => setPicking(true)}
              theme={theme}
              styles={styles}
            />
          ))}
        </View>
      </ScrollView>

      <SpotPicker
        visible={picking}
        spots={availableSpots(list, spots)}
        onPick={(spotId) => {
          setPicking(false);
          const next = addSpot(list, spotId);
          updateList(next);

          // A place you have already written about arrives finished, and
          // nothing is asked. Only a wordless one gets the two questions.
          const spot = spots.find((s) => s.id === spotId);
          if (spot && (spot.shortNote ?? spot.longNote)) return;

          router.push({
            pathname: '/list/[id]/spot/[index]',
            params: { id: list.id, index: next.items.length - 1 },
          });
        }}
        onClose={() => setPicking(false)}
        onAddPlaces={() => {
          setPicking(false);
          setPasting(true);
        }}
      />

      <AddSpotsSheet
        visible={pasting}
        spots={spots}
        locating={locating}
        onAdd={capture}
        onClose={() => setPasting(false)}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

type Styles = ReturnType<typeof makeStyles>;

function FilledRow({
  item,
  index,
  expanded,
  onToggle,
  onEdit,
  theme,
  styles,
}: {
  item: ResolvedItem;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  /** Which question to open on. The line is the first, the answer the second. */
  onEdit: (step: 1 | 2) => void;
  theme: ColorScheme;
  styles: Styles;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel={`${item.title}, spot ${index + 1}`}
          style={({ pressed }) => [styles.numeralTap, pressed && styles.pressed]}
        >
          <Text style={styles.numeral}>{index + 1}</Text>
        </Pressable>

        <View style={styles.headText}>
          <Pressable onPress={onToggle} style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.name} numberOfLines={1}>
              {item.title}
            </Text>
          </Pressable>

          {/* Open, the words are the buttons: tap the line to change the line.
              Closed, the whole row is one target and opens it. */}
          <Pressable
            onPress={expanded ? () => onEdit(1) : onToggle}
            accessibilityRole="button"
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text
              style={[styles.caption, !item.shortNote && styles.captionEmpty]}
              numberOfLines={2}
            >
              {item.shortNote ?? 'What is it?'}
            </Text>
          </Pressable>
        </View>

        {/* A mark, not a control: this row has more behind it. */}
        {item.longNote && !expanded ? (
          <Svg
            width={15}
            height={15}
            viewBox="0 0 24 24"
            fill="none"
            stroke={theme.border}
            strokeWidth={2.2}
            strokeLinecap="round"
          >
            <Path d="M4 7h16" />
            <Path d="M4 12h16" />
            <Path d="M4 17h9" />
          </Svg>
        ) : null}
      </View>

      {expanded ? (
        <Pressable
          onPress={() => onEdit(2)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.expanded, pressed && styles.pressed]}
        >
          <Text style={[styles.answer, !item.longNote && styles.answerEmpty]}>
            {item.longNote ?? 'What else would you like to share?'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function EmptyRow({
  index,
  live,
  onPress,
  theme,
  styles,
}: {
  index: number;
  live: boolean;
  onPress: () => void;
  theme: ColorScheme;
  styles: Styles;
}) {
  return (
    <Pressable
      onPress={live ? onPress : undefined}
      disabled={!live}
      accessibilityRole="button"
      accessibilityLabel={`Add a spot in slot ${index + 1}`}
      style={({ pressed }) => [styles.row, styles.emptyRow, pressed && styles.pressed]}
    >
      <Text style={[styles.numeral, styles.numeralEmpty]}>{index + 1}</Text>
      {/* The ones below the live slot say nothing at all. They are the shape of
          the cap, and the shape says it. */}
      <Text style={styles.addSpot}>{live ? 'Add a spot' : ''}</Text>
      {live ? (
        <Svg
          width={20}
          height={20}
          viewBox="0 0 24 24"
          fill="none"
          stroke={theme.accent}
          strokeWidth={2}
          strokeLinecap="round"
        >
          <Path d="M12 5v14" />
          <Path d="M5 12h14" />
        </Svg>
      ) : null}
    </Pressable>
  );
}

function Back({
  onPress,
  theme,
  styles,
  label,
}: {
  onPress: () => void;
  theme: ColorScheme;
  styles: Styles;
  label?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Back to your lists"
      hitSlop={10}
      style={({ pressed }) => [styles.back, pressed && styles.pressed]}
    >
      <Svg
        width={24}
        height={24}
        viewBox="0 0 24 24"
        fill="none"
        stroke={theme.textPrimary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="M15 18l-6-6 6-6" />
      </Svg>
      {label ? <Text style={styles.backLabel}>{label}</Text> : null}
    </Pressable>
  );
}

const makeStyles = (theme: ColorScheme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    pressed: { opacity: 0.5 },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.lg + 4,
      paddingTop: space.md,
    },
    back: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 44, marginLeft: -8 },
    backLabel: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.medium,
      color: theme.textPrimary,
    },

    body: { paddingHorizontal: space.lg + 4, paddingBottom: space['3xl'] },
    headline: {
      marginTop: space.lg + 4,
      fontSize: fontSize['3xl'],
      lineHeight: 36,
      fontWeight: fontWeight.semibold,
      letterSpacing: letterSpacing.tightest,
      color: theme.textPrimary,
    },

    markRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      marginTop: space.md + 2,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: radius.full,
      borderWidth: 1.5,
      borderColor: theme.textMuted,
    },
    mark: { fontSize: fontSize.base, color: theme.textSecondary },

    rows: { marginTop: space.xl, borderTopWidth: 1, borderTopColor: theme.border },
    row: { borderBottomWidth: 1, borderBottomColor: theme.border },
    emptyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.lg,
      height: 82,
    },

    head: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.lg,
      minHeight: 82,
      paddingVertical: space.md,
    },
    numeralTap: { justifyContent: 'center' },
    headText: { flex: 1, minWidth: 0 },

    /** Large numerals are where green is allowed on a light ground. */
    numeral: {
      width: 26,
      fontFamily: monoFamily,
      fontSize: fontSize['2xl'],
      fontWeight: fontWeight.semibold,
      color: theme.accent,
    },
    numeralEmpty: { color: theme.border },

    name: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.medium,
      letterSpacing: letterSpacing.tight,
      color: theme.textPrimary,
    },
    /** Caption, then body: three sizes carry the hierarchy, so no rule, box or
     *  indent has to. */
    caption: { marginTop: 4, fontSize: fontSize.base, lineHeight: 19, color: theme.textSecondary },
    captionEmpty: { color: theme.textMuted },

    expanded: { paddingLeft: 26 + space.lg, paddingBottom: space.lg + 4 },
    answer: { fontSize: fontSize.md, lineHeight: 22, color: theme.textSecondary },
    answerEmpty: { color: theme.textMuted },

    addSpot: {
      flex: 1,
      fontSize: fontSize.lg,
      letterSpacing: letterSpacing.tight,
      color: theme.textMuted,
    },

    gone: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    goneText: { fontSize: fontSize.md, color: theme.textMuted },
  });
