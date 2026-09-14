import { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useAnimatedValue,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import {
  fontSize,
  fontWeight,
  letterSpacing,
  radius,
  space,
  type ColorScheme,
} from '@real-rex/shared';

import { GettingStarted } from '../components/GettingStarted';
import { ListRing } from '../components/ListRing';
import { useTheme } from '../theme';

/**
 * Home. One frame, always.
 *
 * The header and the paste bar never move — only the middle changes, so an
 * empty library and a full one are the same screen rather than two screens
 * with a transition between them. The paste bar being permanent is also what
 * guarantees there is always a way to add a place.
 *
 * Drawn as "Your recommendations" on the canvas; the headline is "Your lists"
 * because the rows are lists and the recommendations are what is inside them.
 *
 * There is no "No lists yet" line under the headline. It said the same thing
 * as the unchecked "Make a list" step below it, and two statements of the same
 * fact at two different weights read as a hierarchy that isn't there. The
 * checklist says it and also says what to do about it, so it says it alone.
 */

const monoFamily = Platform.select({ ios: 'Menlo', default: 'monospace' });

/**
 * One row on the home screen. Deliberately not a `List` -- home shows how many
 * spots a list holds and whether it is out there, and nothing else, so it asks
 * for exactly that. Decision 25 rejected showing the spots themselves.
 */
export type ListSummary = {
  id: string;
  title: string;
  /** From the second question, when it was answered. Null when skipped. */
  place: string | null;
  count: number;
  state: 'draft' | 'published' | 'edited';
};

type Props = {
  hasPlaces: boolean;
  lists: ListSummary[];
  onPastePlace: () => void;
  onCreateList?: () => void;
  onOpenList?: (id: string) => void;
};

export function Home({ hasPlaces, lists, onPastePlace, onCreateList, onOpenList }: Props) {
  const hasLists = lists.length > 0;
  const theme = useTheme();
  const styles = makeStyles(theme);

  /**
   * Crossing off the last step swaps the checklist for the lists themselves.
   * Fading rather than cutting, so the screen reads as filling up rather than
   * as a different screen arriving — the frame around it never moved.
   */
  const fade = useAnimatedValue(1);
  const wasEmpty = useRef(!hasLists);
  useEffect(() => {
    if (wasEmpty.current === !hasLists) return;
    wasEmpty.current = !hasLists;
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [hasLists, fade]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>REAL REX</Text>

        {/* The button lives on the headline's own row so it centres against
            it, rather than against the whole block — otherwise the status
            line below drags it down. */}
        <View style={styles.titleRow}>
          <Text style={styles.headline}>Your lists</Text>

          {/* Always here, in both states. It is how a list gets made forever,
              so it is how the first one gets made too. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="New list"
            onPress={onCreateList}
            hitSlop={10}
            style={({ pressed }) => [styles.new, pressed && styles.newPressed]}
          >
            <Svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={2.5}
              strokeLinecap="round"
            >
              <Path d="M12 5v14" />
              <Path d="M5 12h14" />
            </Svg>
          </Pressable>
        </View>
      </View>

      <Animated.View style={[styles.bodyWrap, { opacity: fade }]}>
        <ScrollView contentContainerStyle={styles.body}>
          {hasLists ? (
            <View style={styles.rows}>
              {lists.map((list) => (
                <Pressable
                  key={list.id}
                  onPress={() => onOpenList?.(list.id)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <ListRing filled={list.count} theme={theme} />
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {list.title.trim() === '' ? 'Untitled list' : list.title}
                    </Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {statusLine(list)}
                    </Text>
                  </View>
                  {/* Decision 25: a link on the row is what marks a list sent.
                      No badge does the same job twice. */}
                  {list.state === 'draft' ? null : <LinkIcon color={theme.textMuted} />}
                </Pressable>
              ))}
            </View>
          ) : (
            <GettingStarted hasPlaces={hasPlaces} hasLists={hasLists} />
          )}
        </ScrollView>
      </Animated.View>

      <View style={styles.pasteWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Paste a Google Maps link"
          onPress={onPastePlace}
          style={({ pressed }) => [
            styles.paste,
            !hasPlaces && styles.pasteOnly,
            pressed && styles.pastePressed,
          ]}
        >
          <Svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke={hasPlaces ? theme.textMuted : theme.accentText}
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <Path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </Svg>
          <Text style={[styles.pasteLabel, !hasPlaces && styles.pasteLabelOnly]}>
            Paste a Google Maps link
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/**
 * The three states, said in words on the row rather than worn as a badge --
 * with the place in front of them.
 *
 * The place leads because it is the only thing telling four lists called
 * "Top 5" apart, and this line is clipped to one. Everything after it degrades
 * gracefully: lose the tail and you lose the wordiest state, which the link
 * icon on the row is already saying.
 */
const statusLine = (list: ListSummary): string => {
  const spots = `${list.count} ${list.count === 1 ? 'spot' : 'spots'}`;
  const place = list.place?.trim();

  const parts = place ? [place, spots] : [spots];
  if (list.state === 'published') parts.push('sent');
  if (list.state === 'edited') parts.push('edited since you sent it');

  return parts.join(' · ');
};

const LinkIcon = ({ color }: { color: string }) => (
  <Svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <Path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </Svg>
);

const makeStyles = (theme: ColorScheme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },

    header: {
      paddingHorizontal: space.lg + 4,
      paddingTop: space['2xl'],
      /**
       * Fixed, so the band below it is the same size in every state and what
       * is in it never shifts as the middle changes.
       */
      height: 112,
    },

    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    eyebrow: {
      fontFamily: monoFamily,
      fontSize: fontSize.xs,
      letterSpacing: letterSpacing.wide,
      color: theme.textMuted,
    },
    headline: {
      marginTop: space.sm,
      lineHeight: 34,
      fontSize: fontSize['3xl'],
      fontWeight: fontWeight.semibold,
      letterSpacing: letterSpacing.tightest,
      color: theme.textPrimary,
    },
    /** A filled circle rather than a word: it is the one action in the header,
     *  and green is allowed on a fill (tokens.ts). */
    new: {
      /**
       * Nudged down: `alignItems: center` centres on the text's line box, and
       * a 29px face carries more space above the caps than below them, so the
       * circle reads high against the glyphs even when the boxes agree.
       */
      marginTop: 3,
      width: 40,
      height: 40,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
    },
    newPressed: { opacity: 0.85 },

    bodyWrap: { flex: 1 },
    body: { flexGrow: 1 },

    /**
     * The public page's row, with the ring where the numeral goes. Hairlines
     * between, nothing around: the list of lists is the same object as the
     * list of spots, one level up.
     */
    rows: { paddingHorizontal: space.lg + 4, paddingTop: space.sm },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.lg,
      height: 78,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    rowPressed: { opacity: 0.6 },
    rowText: { flex: 1, minWidth: 0 },
    rowTitle: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.medium,
      letterSpacing: letterSpacing.tight,
      color: theme.textPrimary,
    },
    rowSub: { marginTop: 3, fontSize: fontSize.base, color: theme.textSecondary },
    /**
     * Top-aligned in both states. Centring floated the block in the middle of
     * a large void; anchored to the top it reads in the order it is read, and
     * the space pools above the paste bar where the next action is.
     */

    pasteWrap: { paddingHorizontal: space.lg + 4, paddingBottom: space.md },
    paste: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      height: 52,
      paddingHorizontal: 18,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.full,
    },
    /**
     * With nothing in the library this is the only thing to do on the screen,
     * so it takes the accent — the treatment first open was drawn with. Once
     * there are places it steps back to a hairline and becomes a tool rather
     * than an instruction. Same control throughout; only its weight changes.
     */
    pasteOnly: { borderWidth: 2, borderColor: theme.accent },
    pastePressed: { opacity: 0.7 },
    pasteLabel: { fontSize: fontSize.md, color: theme.textMuted },
    pasteLabelOnly: { color: theme.textSecondary },
  });
