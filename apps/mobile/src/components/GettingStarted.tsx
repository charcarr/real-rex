import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
  fontSize,
  fontWeight,
  letterSpacing,
  radius,
  space,
  type ColorScheme,
} from '@real-rex/shared';

import { useTheme } from '../theme';
import { RealRexMark } from './RealRexMark';

/**
 * What home holds until there is a list to show.
 *
 * Deliberately has no buttons of its own. Both things it describes are done
 * with controls that are already on screen and stay there forever — the paste
 * bar below, and the plus above — so learning this screen teaches the real app
 * rather than a tutorial that has to be un-learned.
 *
 * What it adds is the order, which two controls side by side cannot say: you
 * cannot make a list before you have places. The rail through the markers is
 * that order, and the checks are the user's own progress along it.
 *
 * The third step is the payoff rather than a task, so it is never checked.
 */

const monoFamily = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** Width of the marker column. The rail runs down its centre. */
const MARKER = 28;

/** Width of the rex on the label. */
const MARK = 32;

/**
 * Height of the label that straddles the card's top edge, from the mark's own
 * aspect ratio — it is the tallest thing in that row. Half of it hangs above
 * the border, so the card's top padding has to clear the other half.
 */
const LABEL = Math.round((MARK * 1472) / 1686);

type Props = { hasPlaces: boolean; hasLists: boolean };

export function GettingStarted({ hasPlaces, hasLists }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const steps = [
    {
      done: hasPlaces,
      title: 'Add some places',
      detail: 'Make a library of places that are special to you',
    },
    {
      done: hasLists,
      title: 'Make a list',
      detail: 'Up to five places',
    },
    {
      done: null as boolean | null,
      title: 'Share a webpage',
      detail: 'The recipient will browse your list on a nice webpage.',
    },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        {/* A section marker, not a second title. At 24pt semibold this read as
            a headline competing with "Your lists"; the screen gets one of those
            (decision 25). Mono caps is what the system already uses to label a
            section — the same device as REAL REX above.

            It sits ON the card's top edge rather than inside it, cutting the
            hairline the way a fieldset legend does. That is what makes the box
            read as one labelled object instead of a border with a heading
            floating near it. */}
        <View style={styles.headRow} pointerEvents="none">
          <View style={styles.head}>
            <RealRexMark size={MARK} color={theme.brandMark} />
            <Text style={styles.title}>HOW IT WORKS</Text>
          </View>
        </View>

        <View style={styles.steps}>
          {steps.map((step, index) => {
            const isLast = index === steps.length - 1;
            return (
              <View key={step.title} style={[styles.step, isLast && styles.stepLast]}>
                <View style={styles.marker}>
                  {step.done === true ? (
                    <CheckIcon color={theme.accent} />
                  ) : (
                    <Text style={styles.numeral}>{index + 1}</Text>
                  )}
                  {/* The rail. Green behind you, grey ahead. */}
                  {isLast ? null : (
                    <View style={[styles.rail, step.done === true && styles.railDone]} />
                  )}
                </View>

                <View style={styles.stepText}>
                  <Text style={[styles.stepTitle, step.done === true && styles.stepTitleDone]}>
                    {step.title}
                  </Text>
                  <Text style={styles.stepDetail}>{step.detail}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const CheckIcon = ({ color }: { color: string }) => (
  <Svg
    width={22}
    height={22}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2.75}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M4 12.5l5.5 5.5L20 7" />
  </Svg>
);

const makeStyles = (theme: ColorScheme) =>
  StyleSheet.create({
    /** Aligned to the same gutter as the headline and the paste bar, so the
     *  card's edges line up with the rest of the screen rather than sitting in
     *  their own inset. */
    wrap: { paddingHorizontal: space.lg + 4, paddingTop: space['2xl'] },

    /**
     * Outlined rather than filled. On this ground a fill would need the label
     * to straddle two different colours; a hairline lets the label carry the
     * page colour and cut cleanly through it.
     */
    card: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.xl,
      paddingHorizontal: space.lg,
      paddingTop: LABEL / 2 + space.xl,
      paddingBottom: space.xl,
    },

    /**
     * Straddles the top border: half above the line, half below.
     *
     * Left rather than centred, so the mark's left edge lands on the card's
     * own content gutter and the label sits on the same axis as the markers
     * below it. Centred it was balanced but related to nothing; here the
     * emblem, the numerals and the rail all start from one line.
     */
    headRow: {
      position: 'absolute',
      top: -LABEL / 2,
      left: 0,
      right: 0,
      alignItems: 'flex-start',
      // The label's own padding is what cuts the border, so subtract it to
      // put the mark itself on the gutter.
      paddingLeft: space.lg - space.md,
    },
    /** Centred, so the mark and the label read as one small emblem over the
     *  left-aligned steps rather than as another thing on the left edge. The
     *  page colour behind it is what cuts the hairline. */
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: LABEL,
      paddingHorizontal: space.md,
      backgroundColor: theme.background,
    },
    title: {
      fontFamily: monoFamily,
      fontSize: fontSize.xs,
      letterSpacing: letterSpacing.wide,
      color: theme.textMuted,
    },

    steps: {},

    /** stretch, so the marker column fills the row and the rail can span it. */
    step: { flexDirection: 'row', gap: space.lg, alignItems: 'stretch', paddingBottom: space.xl },
    stepLast: { paddingBottom: 0 },

    marker: { width: MARKER, alignItems: 'center' },
    numeral: {
      fontFamily: monoFamily,
      fontSize: fontSize['2xl'],
      fontWeight: fontWeight.semibold,
      // Green is allowed on large numerals, not on body text — tokens.ts.
      color: theme.accent,
      lineHeight: 26,
    },
    rail: {
      flex: 1,
      width: 1.5,
      marginTop: space.sm,
      marginBottom: -space.xl,
      borderRadius: 1,
      backgroundColor: theme.border,
    },
    railDone: { backgroundColor: theme.accent },

    stepText: { flex: 1, minWidth: 0, paddingTop: 1 },
    stepTitle: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.semibold,
      letterSpacing: letterSpacing.tight,
      color: theme.textPrimary,
    },
    /** Done steps step back rather than disappear — the list is still the
     *  explanation of what this app is. */
    stepTitleDone: { color: theme.textSecondary },
    stepDetail: {
      marginTop: space.xs,
      fontSize: fontSize.base,
      color: theme.textSecondary,
      lineHeight: 19,
    },
  });
