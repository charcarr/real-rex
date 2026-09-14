import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  SHORT_NOTE_MAX,
  fontSize,
  fontWeight,
  radius,
  space,
  type ColorScheme,
} from '@real-rex/shared';

import { Question } from '../../../../src/components/Question';
import { overrideItem, resolve } from '../../../../src/lists';
import { useStore } from '../../../../src/store';
import { useTheme } from '../../../../src/theme';

/**
 * Writing about one place, two questions deep.
 *
 * WHERE THE WORDS GO, AND WHY IT IS USUALLY NOT A QUESTION. Notes belong to
 * the place. Write about somewhere once and every list you put it on says the
 * same thing, which is the whole point of keeping a library -- Charley: "that
 * way forever and ever you're not always adding notes."
 *
 * So the scope is only ever raised when it is genuinely a question: you are
 * changing words this place already had, and the app cannot know whether you
 * mean to change them everywhere or only here. It appears the moment the
 * draft stops matching the library and goes away again if you put it back.
 * Default is the place.
 *
 * WHY THE SECOND QUESTION IS PHRASED THE WAY IT IS (decision 44). "Why would
 * you send someone here?" asked for a justification, and people answer
 * justifications with reasons a stranger would accept: good coffee, nice for
 * groups. That is a review. What the product wants is disclosure -- something
 * true about the writer, not the place -- so the question asks what they would
 * pass on rather than what case they would make.
 *
 * It stays a *wh*-question on purpose. "Anything else to share?" was the other
 * candidate and it is answerable with "no", which on a screen that also has a
 * Skip button is handing out the exit twice.
 *
 * Nothing is written until you leave, and backing out of the first question
 * is a save rather than a cancel -- there is no draft to keep and nothing
 * here is destructive.
 *
 * Which is why the swipe back is off. It is the one way out that would not
 * run the save, and silently dropping what someone just typed is worse than
 * asking them to use the arrow. When storage lands this can write through on
 * every keystroke and the gesture comes back.
 */
export default function SpotRoute() {
  const { id, index, step } = useLocalSearchParams<{ id: string; index: string; step?: string }>();
  const { spots, listById, updateList, writeSpot } = useStore();
  const theme = useTheme();
  const styles = makeStyles(theme);

  const list = listById(id);
  const slot = Number(index);
  const item = list?.items[slot] ?? null;
  const resolved = item ? resolve(item, spots) : null;

  const [asking, setAsking] = useState<1 | 2>(step === '2' ? 2 : 1);
  const [short, setShort] = useState(resolved?.shortNote ?? '');
  const [long, setLong] = useState(resolved?.longNote ?? '');
  const [scope, setScope] = useState<'place' | 'list'>('place');

  if (!list || !item || !resolved) {
    router.replace('/');
    return null;
  }

  const spot = resolved.spot;
  const hadWords = Boolean(spot.shortNote ?? spot.longNote);
  const changed = short !== (spot.shortNote ?? '') || long !== (spot.longNote ?? '');
  /** The only time the scope is a real question. */
  const asks = hadWords && changed;

  const save = () => {
    if (asks && scope === 'list') {
      updateList(overrideItem(list, slot, { shortNote: short, longNote: long }));
      return;
    }
    // The library is the default home for words, so writing there also clears
    // anything this list was saying instead -- the override has just been
    // answered by the place itself.
    writeSpot(spot.id, { shortNote: short, longNote: long });
    updateList(overrideItem(list, slot, { shortNote: null, longNote: null }));
  };

  const leave = () => {
    save();
    router.back();
  };

  const frame = <Stack.Screen options={{ gestureEnabled: false }} />;

  if (asking === 1) {
    return (
      <>
        {frame}
        <Question
          eyebrowLead={String(slot + 1)}
          eyebrow={spot.title.toUpperCase()}
          question="What is this place?"
          value={short}
          onChangeText={setShort}
          placeholder="The neighbourhood gelato spot."
          maxLength={SHORT_NOTE_MAX}
          onSubmit={() => setAsking(2)}
          submitLabel="Next"
          onBack={leave}
          onSkip={() => setAsking(2)}
          progress={0.5}
        >
          {asks ? <ScopeChoice scope={scope} onChange={setScope} styles={styles} /> : null}
        </Question>
      </>
    );
  }

  return (
    <>
      {frame}
      <Question
        eyebrowLead={String(slot + 1)}
        eyebrow={spot.title.toUpperCase()}
        question="What else would you like to share?"
        value={long}
        onChangeText={setLong}
        placeholder={askingPlaceholder(spot.id)}
        multiline
        onSubmit={leave}
        submitLabel="Done"
        onBack={() => setAsking(1)}
        onSkip={leave}
        progress={1}
      >
        {asks ? <ScopeChoice scope={scope} onChange={setScope} styles={styles} /> : null}
      </Question>
    </>
  );
}

/**
 * The placeholder does more teaching than the question can.
 *
 * Each is the kind of thing the question is fishing for: a habit and a memory
 * in one breath, a tip you only have because you go, a person by name. Nobody
 * writes "great vibes" straight after reading one.
 *
 * The long one is first on purpose -- two clauses show that an answer may be
 * more than one thought, which a single-clause example quietly forbids. The
 * short ones are there so the bar is not a first date. Keyed by the spot, so it
 * is steady for a place and varies across the library; one fixed example would
 * read as the required answer.
 */
const EXAMPLES = [
  "We go here after work on Wednesdays, it's also where Patrick and I had our first date.",
  'Book a table, it fills up fast.',
  'Gina is the best instructor here, but honestly go anytime.',
];

function askingPlaceholder(spotId: string): string {
  let hash = 0;
  for (const character of spotId) hash = (hash + character.charCodeAt(0)) % EXAMPLES.length;
  return EXAMPLES[hash]!;
}

/**
 * Two words, outlined rather than filled.
 *
 * One choice covers both questions. Splitting it per field would be more
 * precise and a great deal more to read on a screen whose job is to be quiet.
 */
function ScopeChoice({
  scope,
  onChange,
  styles,
}: {
  scope: 'place' | 'list';
  onChange: (next: 'place' | 'list') => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const onPlace = scope === 'place';

  return (
    <View style={styles.scope}>
      <Text style={styles.scopeLabel}>Save to</Text>

      <View style={styles.pills}>
        <Pressable
          onPress={() => onChange('place')}
          accessibilityRole="button"
          accessibilityState={{ selected: onPlace }}
          style={({ pressed }) => [styles.pill, onPlace && styles.pillOn, pressed && styles.faded]}
        >
          <Text style={[styles.pillLabel, onPlace && styles.pillLabelOn]}>the place</Text>
        </Pressable>

        <Pressable
          onPress={() => onChange('list')}
          accessibilityRole="button"
          accessibilityState={{ selected: !onPlace }}
          style={({ pressed }) => [styles.pill, !onPlace && styles.pillOn, pressed && styles.faded]}
        >
          <Text style={[styles.pillLabel, !onPlace && styles.pillLabelOn]}>just this list</Text>
        </Pressable>
      </View>

      <Text style={styles.scopeHint}>
        {onPlace
          ? 'Every list this place is on will say this from now on.'
          : 'Your other lists keep the words they already have.'}
      </Text>
    </View>
  );
}

const makeStyles = (theme: ColorScheme) =>
  StyleSheet.create({
    scope: { marginTop: space.xs },
    scopeLabel: { fontSize: fontSize.base, color: theme.textMuted },
    pills: { flexDirection: 'row', gap: space.sm, marginTop: space.sm + 2 },
    pill: {
      height: 38,
      justifyContent: 'center',
      paddingHorizontal: 15,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: theme.border,
    },
    pillOn: { borderColor: theme.accent },
    pillLabel: { fontSize: fontSize.base, color: theme.textMuted },
    pillLabelOn: { fontWeight: fontWeight.medium, color: theme.accentText },
    faded: { opacity: 0.5 },
    scopeHint: {
      marginTop: space.sm + 2,
      fontSize: fontSize.sm,
      lineHeight: 17,
      color: theme.textMuted,
    },
  });
