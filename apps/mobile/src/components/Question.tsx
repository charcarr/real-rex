import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
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

import { useTheme } from '../theme';

/**
 * One question, a whole screen.
 *
 * This is the rule the builder runs on: every moment that asks for words gets
 * a page to itself with a single question on it. Naming a list is two of
 * these; writing about a place is two more. Nothing else on the screen -- no
 * subtitle, no step count, no labels. The hairline at the foot is the only
 * thing that says where you are, and it says it without words.
 *
 * A single-line question submits on return. The long one cannot: return has
 * to make a paragraph, so that screen is finished with the button.
 */

const monoFamily = Platform.select({ ios: 'Menlo', default: 'monospace' });

type Props = {
  /** Small caps above the question. On a spot it is the place's name. */
  eyebrow: string;
  /** The green numeral before the eyebrow, when the question is about a slot. */
  eyebrowLead?: string;
  question: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  onSubmit: () => void;
  submitLabel: string;
  onBack: () => void;
  /** Present when the question may go unanswered. */
  onSkip?: () => void;
  multiline?: boolean;
  maxLength?: number;
  /** 0 to 1. Two-question flows pass 0.5 then 1. */
  progress: number;
  /** The scope choice, on the rare screen that needs to ask it. */
  children?: ReactNode;
};

export function Question({
  eyebrow,
  eyebrowLead,
  question,
  value,
  onChangeText,
  placeholder,
  onSubmit,
  submitLabel,
  onBack,
  onSkip,
  multiline = false,
  maxLength,
  progress,
  children,
}: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const answered = value.trim().length > 0;
  const submit = () => {
    if (answered) onSubmit();
  };

  /** Only near the cap, and only ever one number. A counter that runs the
   *  whole time is a form telling you it is a form. */
  const left = maxLength === undefined ? null : maxLength - value.length;
  const showLeft = left !== null && left <= 15;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Svg
            width={24}
            height={24}
            viewBox="0 0 24 24"
            fill="none"
            stroke={theme.textMuted}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M15 18l-6-6 6-6" />
          </Svg>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.middle}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.eyebrowRow}>
          {eyebrowLead ? <Text style={styles.eyebrowLead}>{eyebrowLead}</Text> : null}
          <Text style={styles.eyebrow} numberOfLines={1}>
            {eyebrow}
          </Text>
        </View>

        <Text style={styles.question}>{question}</Text>

        <View style={styles.field}>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={theme.textMuted}
            style={[styles.input, multiline && styles.inputLong]}
            multiline={multiline}
            maxLength={maxLength}
            autoFocus
            // A single line finishes on return. A paragraph needs return for
            // itself, so that screen is finished with the button.
            blurOnSubmit={!multiline}
            returnKeyType={multiline ? 'default' : 'done'}
            onSubmitEditing={multiline ? undefined : submit}
          />
          <View style={[styles.rule, answered && styles.ruleOn]} />
          <Text style={styles.left}>{showLeft ? String(left) : ''}</Text>
        </View>

        {children}

        <View style={styles.actions}>
          <Pressable
            onPress={submit}
            disabled={!answered}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.submit,
              !answered && styles.submitOff,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.submitLabel, !answered && styles.submitLabelOff]}>
              {submitLabel}
            </Text>
            <Svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke={answered ? '#FFFFFF' : theme.textMuted}
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M20 6L9 17l-5-5" />
            </Svg>
          </Pressable>

          {answered && !multiline ? <Text style={styles.hint}>PRESS RETURN</Text> : null}

          {onSkip ? (
            <Pressable
              onPress={onSkip}
              accessibilityRole="button"
              hitSlop={10}
              style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
            >
              <Text style={styles.skipLabel}>Skip</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>

      <View style={styles.track}>
        <View style={[styles.progress, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (theme: ColorScheme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.surface },
    pressed: { opacity: 0.5 },

    header: { paddingHorizontal: space.lg + 4, paddingTop: space.md },
    back: {
      width: 44,
      height: 44,
      marginLeft: -10,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },

    middle: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: space.xl + 4,
      paddingBottom: space['4xl'],
    },

    eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 1 },
    eyebrowLead: {
      fontFamily: monoFamily,
      fontSize: fontSize.xs,
      letterSpacing: letterSpacing.wide,
      color: theme.accent,
    },
    eyebrow: {
      flex: 1,
      fontFamily: monoFamily,
      fontSize: fontSize.xs,
      letterSpacing: letterSpacing.wide,
      color: theme.textMuted,
    },

    question: {
      marginTop: space.md + 2,
      fontSize: fontSize['3xl'],
      lineHeight: 36,
      fontWeight: fontWeight.semibold,
      letterSpacing: letterSpacing.tightest,
      color: theme.textPrimary,
    },

    field: { marginTop: space['2xl'] + 4 },
    input: {
      fontSize: fontSize['2xl'],
      lineHeight: 32,
      letterSpacing: letterSpacing.tight,
      color: theme.textPrimary,
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingBottom: space.sm + 2,
    },
    inputLong: { fontSize: fontSize.xl, lineHeight: 29, height: 104, textAlignVertical: 'top' },
    /** A hairline, not a slab. It is a cursor for the page, not a container. */
    rule: { height: 1, backgroundColor: theme.border },
    ruleOn: { backgroundColor: theme.accent },
    left: {
      marginTop: 7,
      height: 16,
      textAlign: 'right',
      fontSize: fontSize.sm,
      color: theme.textMuted,
    },

    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md + 2,
      marginTop: space.lg + 2,
    },
    submit: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      height: 42,
      paddingHorizontal: 18,
      borderRadius: radius.full,
      backgroundColor: theme.accent,
    },
    submitOff: { backgroundColor: theme.background },
    submitLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: '#FFFFFF' },
    submitLabelOff: { color: theme.textMuted },
    hint: {
      fontFamily: monoFamily,
      fontSize: fontSize.xs,
      letterSpacing: letterSpacing.wide,
      color: theme.textMuted,
    },
    skip: { marginLeft: 'auto', height: 44, justifyContent: 'center' },
    skipLabel: { fontSize: fontSize.base, color: theme.textMuted },

    track: { height: 2, backgroundColor: theme.border },
    progress: { height: 2, backgroundColor: theme.accent },
  });
