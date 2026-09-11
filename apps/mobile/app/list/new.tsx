import { router } from 'expo-router';
import { useState } from 'react';

import { Question } from '../../src/components/Question';
import { useStore } from '../../src/store';

/**
 * Naming a list, before you ever see it.
 *
 * Charley's call, and the reason it is worth two screens: "it feels so nice to
 * arrive to a list with your name already on it." A blank headline waiting to
 * be filled in is a form; a list that already knows what it is about is a
 * place you are standing in.
 *
 * The second question is optional and skippable. Answering it is what puts a
 * map under the headline.
 */
export default function NewListRoute() {
  const { createList } = useStore();

  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');

  const begin = (where: string) => {
    const list = createList(title.trim(), where.trim() === '' ? null : where.trim());
    // Replace rather than push: backing out of the list should land on home,
    // not walk you through the questions you just answered.
    router.replace({ pathname: '/list/[id]', params: { id: list.id } });
  };

  if (step === 1) {
    return (
      <Question
        eyebrow="NEW LIST"
        question="What are you recommending?"
        value={title}
        onChangeText={setTitle}
        placeholder="Lisbon for my parents"
        onSubmit={() => setStep(2)}
        submitLabel="Next"
        onBack={() => router.back()}
        progress={0.5}
      />
    );
  }

  return (
    <Question
      eyebrow="NEW LIST"
      question="In a particular location?"
      value={place}
      onChangeText={setPlace}
      placeholder="Lisbon"
      onSubmit={() => begin(place)}
      submitLabel="OK"
      onBack={() => setStep(1)}
      onSkip={() => begin('')}
      progress={1}
    />
  );
}
