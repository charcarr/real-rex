import { router } from 'expo-router';
import { useState } from 'react';

import { AddSpotsSheet } from '../src/components/AddSpotsSheet';
import { PublishSheet } from '../src/components/PublishSheet';
import { markPublished, publishState, unpublish } from '../src/lists';
import { deleteList, publishList, unpublishList } from '../src/publish';
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
  const { spots, lists, locating, capture, updateList, removeList } = useStore();
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
        // Keyed so the sheet's own state -- mid-send, just-copied -- starts
        // fresh every time it is raised, without an effect reaching in to
        // clear it.
        key={publishing ?? 'none'}
        visible={sending !== null}
        list={sending}
        state={sending ? publishState(sending, spots) : 'draft'}
        count={sending?.items.length ?? 0}
        // Both of these throw when the request fails, and the sheet turns that
        // into one line offering to try again. Nothing is written to the device
        // until the server has confirmed it -- so the app can understate what
        // is live, and never overstate it.
        onPublish={async () => {
          if (!sending) return null;

          const remote = await publishList(sending, spots);
          const next = markPublished(sending, spots, remote);
          updateList(next);

          return next.published?.url ?? null;
        }}
        onUnpublish={async () => {
          if (!sending) return;

          await unpublishList(sending);
          updateList(unpublish(sending));
        }}
        onDelete={async () => {
          if (!sending) return;

          // A list that was never published has no row to delete and never
          // minted a user -- and deleting a local draft must not create an
          // account (decision 29).
          if (sending.published) await deleteList(sending);
          removeList(sending.id);
        }}
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
