import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import Svg, { Circle, Path } from 'react-native-svg';

import {
  fontSize,
  fontWeight,
  letterSpacing,
  radius,
  space,
  type ColorScheme,
} from '@real-rex/shared';

import { addFromLink, type AddResult, type Spot } from '../spots';
import { useTheme } from '../theme';

/**
 * Add spots — the burst.
 *
 * Built for the real behaviour: five links pasted in a row while thinking
 * about a city. So the field keeps focus, the row appears the moment the link
 * parses, and nothing asks a question in between (decision 21).
 *
 * Drawn as "Add spots — the burst" on the canvas.
 *
 * NOT YET: geocoding (the LOCATING state), and short-link expansion, which
 * needs the native URLSession module from decision 17. A `maps.app.goo.gl`
 * link therefore fails on purpose, with a message saying so.
 */

const monoFamily = Platform.select({ ios: 'Menlo', default: 'monospace' });

type Props = {
  visible: boolean;
  spots: Spot[];
  /** Ids of spots the geocoder is still working on. */
  locating: string[];
  onAdd: (spot: Spot) => void;
  onClose: () => void;
};

/** What the last paste did, shown as a row above the saved ones. */
type Outcome = Exclude<AddResult, { kind: 'added' }> | null;

export function AddSpotsSheet({ visible, spots, locating, onAdd, onClose }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [draft, setDraft] = useState('');
  const [outcome, setOutcome] = useState<Outcome>(null);
  /** A short link is being expanded. Shown as a row so the burst is not
   *  blocked by a spinner over the whole sheet. */
  const [pending, setPending] = useState(false);

  /**
   * The keyboard's height, straight from the event.
   *
   * KeyboardAvoidingView derives its inset from its own measured frame, and
   * inside a Modal that measurement disagrees with the window — which is what
   * left the sheet floating above the keyboard. The event reports the
   * keyboard's real height in window coordinates, so padding the backdrop by
   * it puts the sheet exactly on top of the keyboard, on both platforms.
   *
   * `will` events are iOS-only and fire in step with the animation; Android
   * only has `did`.
   */
  const [keyboardHeight, setKeyboardHeight] = useState(0);

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

  const submit = async () => {
    const input = draft.trim();
    if (!input) return;

    // Clear immediately: the field is ready for the next link, which is the
    // whole point of the burst (decision 21).
    setDraft('');
    setOutcome(null);
    setPending(true);

    const result = await addFromLink(spots, input);
    setPending(false);

    if (result.kind === 'added') onAdd(result.spot);
    else setOutcome(result);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingBottom: keyboardHeight }]}>
        <View style={[styles.sheet, keyboardHeight === 0 && styles.sheetResting]}>
          <View style={styles.grabber} />

          <View style={styles.header}>
            <Text style={styles.title}>Add spots</Text>
            <Pressable onPress={onClose} accessibilityRole="button" hitSlop={12}>
              <Text style={styles.done}>Done</Text>
            </Pressable>
          </View>

          <View style={styles.inputWrap}>
            <View style={styles.field}>
              <LinkIcon color={theme.accentText} />
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={submit}
                placeholder="Paste a Google Maps link"
                placeholderTextColor={theme.textMuted}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
                // Keeps the keyboard up between pastes, once it is up at all.
                blurOnSubmit={false}
                editable={!pending}
                inputMode="url"
              />
            </View>
            <Text style={styles.hint}>PASTE ANOTHER — YOU CAN WRITE NOTES LATER</Text>
          </View>

          <ScrollView
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
          >
            {pending ? <PendingRow theme={theme} /> : null}
            {outcome ? <OutcomeRow outcome={outcome} theme={theme} /> : null}
            {[...spots].reverse().map((spot) => (
              <SpotRow
                key={spot.id}
                spot={spot}
                locating={locating.includes(spot.id)}
                theme={theme}
              />
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.hint}>
              {spots.length} {spots.length === 1 ? 'SPOT' : 'SPOTS'} IN YOUR LIBRARY
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

function SpotRow({ spot, locating, theme }: { spot: Spot; locating: boolean; theme: ColorScheme }) {
  const styles = makeStyles(theme);
  const subtitle =
    spot.address ??
    (spot.latitude !== null && spot.longitude !== null
      ? `${spot.latitude.toFixed(5)}, ${spot.longitude.toFixed(5)}`
      : 'Looking it up');

  return (
    <View style={styles.row}>
      {locating ? (
        <ActivityIndicator size="small" color={theme.accent} />
      ) : (
        <CheckIcon color={theme.accent} />
      )}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {spot.title}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {locating ? <Text style={styles.rowTag}>LOCATING</Text> : null}
    </View>
  );
}

function PendingRow({ theme }: { theme: ColorScheme }) {
  const styles = makeStyles(theme);
  return (
    <View style={styles.row}>
      <ActivityIndicator size="small" color={theme.accent} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>Opening the link</Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          Following the redirect once, on this device
        </Text>
      </View>
    </View>
  );
}

/** The ways a paste can fail. Each has a different fix, so each says
 *  something different (decision 21). */
function OutcomeRow({ outcome, theme }: { outcome: NonNullable<Outcome>; theme: ColorScheme }) {
  const styles = makeStyles(theme);

  if (outcome.kind === 'duplicate') {
    return (
      <View style={[styles.row, styles.rowMuted]}>
        <InfoIcon color={theme.textMuted} />
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, styles.rowTitleMuted]} numberOfLines={1}>
            {outcome.spot.title}
          </Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            Already in your library
          </Text>
        </View>
      </View>
    );
  }

  // Three different fixes, so three different messages (decision 21). The
  // expansion failure also prints what came back, because that is the data
  // decision 17 was missing.
  const [title, detail] =
    outcome.kind === 'offline'
      ? [
          'You need to be online to add a spot',
          'The link has to be opened up before we know what it points at.',
        ]
      : outcome.kind === 'expansion-failed'
        ? [
            "Couldn't open that link",
            `The redirect came back ${outcome.reason}. ${outcome.observed ?? 'No destination given.'}`,
          ]
        : [
            "That link didn't work",
            'Try copying it again from Maps — open the place first, then Share.',
          ];

  return (
    <View style={[styles.row, styles.rowTall]}>
      <BrokenLinkIcon color={theme.textSecondary} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitleWrap}>{title}</Text>
        <Text style={styles.rowSubWrap} selectable>
          {detail}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

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

const BrokenLinkIcon = ({ color }: { color: string }) => (
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
    <Path d="M3 3l18 18" />
  </Svg>
);

const CheckIcon = ({ color }: { color: string }) => (
  <Svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2.25}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M4 12.5l5.5 5.5L20 7" />
  </Svg>
);

const InfoIcon = ({ color }: { color: string }) => (
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
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 8v5" />
    <Path d="M12 16h.01" />
  </Svg>
);

// ---------------------------------------------------------------------------

const makeStyles = (theme: ColorScheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(10,10,11,0.55)',
    },

    sheet: {
      // Capped so a strip of backdrop always shows above it — a sheet flush
      // against the status bar reads as a screen.
      maxHeight: '88%',
      backgroundColor: theme.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingTop: 10,
    },

    /**
     * The height it opens at. Dropped once the keyboard is up, at which point
     * the sheet hugs its content instead: the field ends up just above the
     * keyboard with a row of list under it, which is where the spot being
     * pasted lands.
     */
    sheetResting: { height: 640 },

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
    done: {
      fontSize: fontSize.base,
      fontWeight: fontWeight.medium,
      color: theme.textPrimary,
    },

    inputWrap: { paddingHorizontal: space.lg + 4 },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      height: 52,
      paddingHorizontal: space.lg,
      backgroundColor: theme.surface,
      borderWidth: 2,
      borderColor: theme.accent,
      borderRadius: radius.md,
    },
    input: {
      flex: 1,
      fontSize: fontSize.md,
      color: theme.textPrimary,
      // Android adds its own vertical padding, which breaks the 52pt row.
      paddingVertical: 0,
    },

    hint: {
      fontFamily: monoFamily,
      fontSize: fontSize.xs,
      letterSpacing: letterSpacing.wide,
      color: theme.textMuted,
      marginTop: space.md,
    },

    /**
     * One row's worth is always visible, so there is somewhere for the next
     * spot to appear. It gives way before the sheet does when room runs short.
     */
    list: {
      // Grows into the resting sheet; floors at one row so there is always
      // somewhere for the next spot to appear when the sheet is short.
      flex: 1,
      minHeight: 96,
      marginTop: 18,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    listContent: { paddingBottom: space.lg },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      minHeight: 70,
      paddingVertical: 14,
      paddingHorizontal: space.lg + 4,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    rowMuted: { backgroundColor: theme.background },
    rowTall: { alignItems: 'flex-start' },

    rowText: { flex: 1, minWidth: 0 },
    rowTitle: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      letterSpacing: letterSpacing.tight,
      color: theme.textPrimary,
    },
    rowTitleMuted: { color: theme.textSecondary },
    rowTitleWrap: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      letterSpacing: letterSpacing.tight,
      color: theme.textPrimary,
    },
    rowSub: {
      fontSize: fontSize.base,
      color: theme.textSecondary,
      marginTop: 3,
    },
    rowSubWrap: {
      fontSize: fontSize.base,
      color: theme.textSecondary,
      marginTop: 3,
      lineHeight: 19,
    },
    rowTag: {
      fontFamily: monoFamily,
      fontSize: fontSize.xs,
      letterSpacing: letterSpacing.wide,
      color: theme.textMuted,
    },

    footer: {
      marginTop: 'auto',
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingHorizontal: space.lg + 4,
      paddingTop: 14,
      paddingBottom: 30,
    },
  });
