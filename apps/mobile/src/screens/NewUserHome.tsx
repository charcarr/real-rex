import { Pressable, StyleSheet, Text, View } from 'react-native';
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

import { RealRexMark } from '../components/RealRexMark';
import { useTheme } from '../theme';

/**
 * Home, before there is anything to show.
 *
 * This is the first screen anyone sees, so it does the explaining: the brand
 * line, what to do, and the honest note that nothing leaves the device. Once
 * the library has lists this route renders the populated home instead.
 *
 * Drawn as "First open A" on the Real Rex App Screens canvas.
 */

type Props = {
  /** Opens the paste flow. Not built yet — see todo.md section 5. */
  onPasteFirstPlace?: () => void;
};

export function NewUserHome({ onPasteFirstPlace }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Vertically centred rather than top-aligned: there is nothing above it
          to anchor to, and centred reads as a statement instead of an empty
          list. */}
      <View style={styles.centre}>
        <RealRexMark size={72} color={theme.brandMark} />

        {/* The brand line. Used once — here, the store listing and the page
            footer — never repeated in-product. */}
        <Text style={styles.headline}>
          Recommend your best.{'\n'}Forget the rest.
        </Text>

        <Text style={styles.body}>
          Paste a place from Google Maps to get started.
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Paste your first place"
          onPress={onPasteFirstPlace}
          style={({ pressed }) => [styles.field, pressed && styles.fieldPressed]}
        >
          <Svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke={theme.accentText}
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <Path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </Svg>
          <Text style={styles.fieldLabel}>Paste your first place</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (theme: ColorScheme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },

    centre: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: space.xl,
    },

    headline: {
      marginTop: space['2xl'],
      fontSize: fontSize['3xl'],
      fontWeight: fontWeight.semibold,
      letterSpacing: letterSpacing.tightest,
      color: theme.textPrimary,
      // React Native takes an absolute lineHeight, not a multiplier: 29 * 1.2.
      lineHeight: 35,
    },

    body: {
      marginTop: space.lg,
      maxWidth: 300,
      fontSize: fontSize.md,
      color: theme.textSecondary,
      lineHeight: 22, // 14 * 1.55
    },

    field: {
      marginTop: space['2xl'],
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      paddingHorizontal: 20,
      backgroundColor: theme.surface,
      // The one heavy border in the app. It is the only thing to do on this
      // screen, so it gets the accent rather than a hairline.
      borderWidth: 2,
      borderColor: theme.accent,
      borderRadius: radius.full,
    },
    fieldPressed: { opacity: 0.7 },

    fieldLabel: { fontSize: fontSize.md, color: theme.textSecondary },
  });
