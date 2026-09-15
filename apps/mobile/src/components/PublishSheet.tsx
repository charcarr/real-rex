import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
  fontSize,
  fontWeight,
  letterSpacing,
  radius,
  space,
  type ColorScheme,
} from '@real-rex/shared';

import { copyToClipboard } from '../clipboard';
import type { List, PublishState } from '../lists';
import { useTheme } from '../theme';

/**
 * Sending a list, and everything that follows from having sent it.
 *
 * Decision 45: one sheet does the lot -- send, copy, share, publish edits,
 * unpublish -- raised from the row on home and dismissed back to it. A page was
 * drawn and rejected as a fourth screen; row controls were drawn and rejected
 * because the row ends up carrying a pill and a link at once and the URL is
 * never actually shown.
 *
 * It is a sheet rather than a page because 38's rule is about moments that ask
 * for WORDS. This one asks for a tap and then hands something back, which is
 * what `AddSpotsSheet` and `SpotPicker` already do.
 *
 * There is no identity question on it yet. Decision 29 says publishing is where
 * the sign-in choice belongs, but Apple sign-in does not exist, so today every
 * list is published anonymously and the sheet stays quiet about it -- what it
 * costs you to be anonymous is only worth saying next to the alternative. Both
 * the choice and the line explaining it land here when sign-in arrives.
 */

type Props = {
  visible: boolean;
  list: List | null;
  state: PublishState;
  /** How many spots are on it. Passed rather than derived: the sheet does not
   *  resolve items against the library, and does not need to. */
  count: number;
  /** Does the publish and answers with the link. Owns the wait -- today a
   *  stubbed one, later the requests -- so nothing here changes when it
   *  becomes real. */
  onPublish: () => Promise<string | null>;
  onUnpublish: () => void;
  onClose: () => void;
};

const midnight = (d: Date): number =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * Today and yesterday get names rather than dates.
 *
 * "the version from 15 September", read on 15 September, says nothing at all --
 * and most publishing happens on the day you are looking at it.
 */
const when = (iso: string): string => {
  const then = new Date(iso);
  const days = Math.round((midnight(new Date()) - midnight(then)) / 86_400_000);

  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `on ${then.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}`;
};

export function PublishSheet({
  visible,
  list,
  state,
  count,
  onPublish,
  onUnpublish,
  onClose,
}: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  // Both reset on every opening, because the caller keys this component by the
  // list being published -- a "copied" line left over from last time would be a
  // lie about this one.
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!list) return null;

  const published = list.published;
  const url = published?.url ?? null;
  const spots = `${count} ${count === 1 ? 'spot' : 'spots'}`;

  const send = async () => {
    setSending(true);
    try {
      const link = await onPublish();
      // Copying on the way out is the whole point of the screen: the next
      // thing anyone does is paste it into a chat.
      if (link) {
        await copyToClipboard(link);
        setCopied(true);
      }
    } finally {
      setSending(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    await copyToClipboard(url);
    setCopied(true);
  };

  const share = () => {
    if (url) void Share.share({ message: url });
  };

  /** A native alert, which is also where the one red in this app comes from --
   *  the OS supplies destructive styling and it costs no palette. */
  const confirmUnpublish = () =>
    Alert.alert(
      'Unpublish this list?',
      'Anyone with the link will see nothing until you publish it again. The link itself is kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unpublish', style: 'destructive', onPress: onUnpublish },
      ],
    );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismiss} onPress={onClose} accessibilityLabel="Close" />

        <View style={styles.sheet}>
          <View style={styles.grabber} />

          {state === 'draft' ? (
            <>
              <Text style={styles.title}>Send this list</Text>
              <Text style={styles.sub}>
                {list.title.trim() === '' ? 'Untitled list' : list.title} &middot; {spots}
              </Text>

              <Primary label="Send" busy={sending} onPress={send} theme={theme} styles={styles} />

              <Text style={styles.caption}>
                {published
                  ? 'It goes back up at the same link you sent before.'
                  : 'Anyone with the link can open it.'}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>
                {list.title.trim() === '' ? 'Untitled list' : list.title}
              </Text>

              {state === 'edited' ? (
                <View style={styles.markRow}>
                  <View style={styles.dot} />
                  <Text style={styles.sub}>Edits not yet published</Text>
                </View>
              ) : (
                <Text style={styles.sub}>
                  {published?.publishedAt ? `Published ${when(published.publishedAt)} · ` : ''}
                  {spots}
                </Text>
              )}

              {state === 'edited' ? (
                <>
                  <Primary
                    label="Publish edits"
                    busy={sending}
                    onPress={send}
                    theme={theme}
                    styles={styles}
                  />
                  <Text style={styles.caption}>
                    {published?.publishedAt
                      ? `Anyone you sent this to is still seeing the version you published ${when(published.publishedAt)}. The link does not change.`
                      : 'The link does not change.'}
                  </Text>
                </>
              ) : null}

              <Pressable
                onPress={copy}
                accessibilityRole="button"
                accessibilityLabel="Copy the link"
                style={({ pressed }) => [styles.linkCard, pressed && styles.pressed]}
              >
                <Text style={styles.link} numberOfLines={1}>
                  {url}
                </Text>
                <View style={styles.copyPill}>
                  <Text style={styles.copyLabel}>Copy</Text>
                </View>
              </Pressable>

              {copied ? (
                <View style={styles.copiedRow}>
                  <Svg
                    width={14}
                    height={14}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={theme.accentText}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <Path d="M20 6L9 17l-5-5" />
                  </Svg>
                  <Text style={styles.copiedLabel}>Copied to your clipboard</Text>
                </View>
              ) : null}

              <Outline label="Share" onPress={share} styles={styles} />
              <Outline label="Unpublish" onPress={confirmUnpublish} styles={styles} />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

/** The one filled button on the sheet. Busy keeps its shape rather than
 *  swapping in a smaller control, so nothing under it moves. */
function Primary({
  label,
  busy,
  onPress,
  theme,
  styles,
}: {
  label: string;
  busy: boolean;
  onPress: () => void;
  theme: ColorScheme;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      onPress={busy ? undefined : onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy }}
      style={({ pressed }) => [styles.primary, (pressed || busy) && styles.primaryQuiet]}
    >
      {busy ? (
        <ActivityIndicator color={theme.surface} />
      ) : (
        <Text style={styles.primaryLabel}>{label}</Text>
      )}
    </Pressable>
  );
}

/** Share and Unpublish are the same control at the same weight. Decision 45:
 *  there is no reason to discourage unpublishing, so it is not made small. */
function Outline({
  label,
  onPress,
  styles,
}: {
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.outline, pressed && styles.pressed]}
    >
      <Text style={styles.outlineLabel}>{label}</Text>
    </Pressable>
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
      paddingBottom: space.xl + space.sm,
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

    /** The same mark the list page carries, for the same reason: neutral, so it
     *  states a fact rather than raising an alarm (decision 45). */
    markRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
    dot: {
      width: 7,
      height: 7,
      borderRadius: radius.full,
      borderWidth: 1.5,
      borderColor: theme.textMuted,
    },

    caption: {
      marginTop: space.md,
      paddingHorizontal: space.xs,
      fontSize: fontSize.base,
      lineHeight: 18,
      color: theme.textSecondary,
    },

    primary: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 56,
      marginTop: space.xl,
      borderRadius: radius.full,
      backgroundColor: theme.accent,
    },
    primaryQuiet: { opacity: 0.55 },
    primaryLabel: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.semibold,
      letterSpacing: letterSpacing.tight,
      color: theme.surface,
    },

    outline: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 56,
      marginTop: space.sm + 2,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: theme.border,
    },
    outlineLabel: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.semibold,
      letterSpacing: letterSpacing.tight,
      color: theme.textPrimary,
    },

    linkCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      marginTop: space.lg + 4,
      paddingLeft: space.lg,
      paddingRight: space.md + 2,
      paddingVertical: space.md + 2,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
    },
    link: {
      flex: 1,
      minWidth: 0,
      fontSize: fontSize.md,
      color: theme.textPrimary,
    },
    copyPill: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 32,
      paddingHorizontal: space.lg - 2,
      borderRadius: radius.full,
      backgroundColor: theme.accent,
    },
    copyLabel: { fontSize: fontSize.sm + 1, fontWeight: fontWeight.semibold, color: theme.surface },

    copiedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm - 2,
      marginTop: space.md,
    },
    copiedLabel: { fontSize: fontSize.base, color: theme.textSecondary },
  });
