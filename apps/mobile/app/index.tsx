import { router } from 'expo-router';
import { useState } from 'react';

import { AddSpotsSheet } from '../src/components/AddSpotsSheet';
import { publishState } from '../src/lists';
import { Home, type ListSummary } from '../src/screens/Home';
import { useStore } from '../src/store';

/**
 * Home.
 *
 * One screen in both states -- the header and the paste bar are constant, and
 * the middle is either the getting-started checklist or the lists themselves.
 *
 * It holds nothing any more. The library and the lists live in the store,
 * because the builder is a route rather than a modal now and three other
 * screens need the same two collections.
 */
export default function HomeRoute() {
  const { spots, lists, locating, capture } = useStore();
  const [pasting, setPasting] = useState(false);

  const summaries: ListSummary[] = lists.map((list) => ({
    id: list.id,
    title: list.title,
    place: list.place,
    count: list.items.length,
    state: publishState(list, spots),
  }));

  return (
    <>
      <Home
        hasPlaces={spots.length > 0}
        lists={summaries}
        onPastePlace={() => setPasting(true)}
        onCreateList={() => router.push('/list/new')}
        onOpenList={(id) => router.push({ pathname: '/list/[id]', params: { id } })}
      />

      <AddSpotsSheet
        visible={pasting}
        spots={spots}
        locating={locating}
        onAdd={capture}
        onClose={() => setPasting(false)}
      />
    </>
  );
}
