import { router } from 'expo-router';
import { useState } from 'react';

import { AddSpotsSheet } from '../src/components/AddSpotsSheet';
import { PublishSheet } from '../src/components/PublishSheet';
import { markPublished, publishState, unpublish } from '../src/lists';
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
  const { spots, lists, locating, capture, updateList } = useStore();
  const [pasting, setPasting] = useState(false);
  /** The list whose publish sheet is up, if any. Held by id rather than by
   *  value so the sheet re-reads the store after every write and shows what
   *  just happened. */
  const [publishing, setPublishing] = useState<string | null>(null);

  const sending = publishing === null ? null : (lists.find((l) => l.id === publishing) ?? null);

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
        onPublish={setPublishing}
      />

      <PublishSheet
        visible={sending !== null}
        list={sending}
        state={sending ? publishState(sending, spots) : 'draft'}
        count={sending?.items.length ?? 0}
        onPublish={async () => {
          if (!sending) return null;
          // Stands in for the two requests decision 46 describes. The wait is
          // deliberate: the sheet's sending state has to be a real thing to
          // look at, and putting it here means nothing in the sheet changes
          // when the network arrives in its place.
          await new Promise((resolve) => setTimeout(resolve, 900));

          const next = markPublished(sending, spots);
          updateList(next);
          return next.published?.url ?? null;
        }}
        onUnpublish={() => sending && updateList(unpublish(sending))}
        onClose={() => setPublishing(null)}
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
