import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Question } from '../../../src/components/Question';
import { setPlace, setTitle } from '../../../src/lists';
import { useStore } from '../../../src/store';

/**
 * Changing a list's name or its location.
 *
 * The same two questions that made the list, seeded with what it says now.
 * "Tap the words to change the words" is already the rule on a spot row; this
 * is that rule one level up, and it is why there is no edit screen of its own
 * -- there is no second way to ask these two things.
 *
 * `step` says which one you land on: the headline opens the first, the map
 * label opens the second. Backing out of the question you arrived at leaves,
 * rather than walking you through the one you did not come for.
 *
 * Nothing is written until you leave, and leaving is a save rather than a
 * cancel -- as on the spot questions, and for the same reason the swipe back
 * is off here: it is the one exit that would skip it.
 */
export default function EditListRoute() {
  const { id, step } = useLocalSearchParams<{ id: string; step?: string }>();
  const { listById, updateList } = useStore();

  const list = listById(id);
  const [enteredAt] = useState<1 | 2>(step === '2' ? 2 : 1);
  const [asking, setAsking] = useState<1 | 2>(enteredAt);
  const [title, setTitleDraft] = useState(list?.title ?? '');
  const [place, setPlaceDraft] = useState(list?.place ?? '');

  if (!list) {
    router.replace('/');
    return null;
  }

  const leave = () => {
    // A cleared location is an answer -- setPlace turns empty into null, which
    // takes the map off the page. A cleared NAME is not: the question will not
    // submit empty, and backing out of it should not quietly unname the list
    // either, so an empty title keeps the one it had.
    const named = title.trim() === '' ? list.title : title.trim();
    updateList(setPlace(setTitle(list, named), place));
    router.back();
  };

  const frame = <Stack.Screen options={{ gestureEnabled: false }} />;

  if (asking === 1) {
    return (
      <>
        {frame}
        <Question
          eyebrow="YOUR LIST"
          question="What are you recommending?"
          value={title}
          onChangeText={setTitleDraft}
          placeholder="Lisbon for my parents"
          onSubmit={() => setAsking(2)}
          submitLabel="Next"
          onBack={leave}
          progress={0.5}
        />
      </>
    );
  }

  return (
    <>
      {frame}
      <Question
        eyebrow="YOUR LIST"
        question="In a particular location?"
        value={place}
        onChangeText={setPlaceDraft}
        placeholder="Lisbon"
        optional
        onSubmit={leave}
        submitLabel="OK"
        onBack={enteredAt === 2 ? leave : () => setAsking(1)}
        progress={1}
      />
    </>
  );
}
