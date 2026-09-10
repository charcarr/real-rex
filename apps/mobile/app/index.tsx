import { useState } from 'react';

import { AddSpotsSheet } from '../src/components/AddSpotsSheet';
import type { NoteDraft } from '../src/components/NoteEditor';
import { fillInMissing } from '../src/geocode';
import { emptyList, markPublished, publishState, type List } from '../src/lists';
import { Home, type ListSummary } from '../src/screens/Home';
import { ListBuilder } from '../src/screens/ListBuilder';
import type { Spot } from '../src/spots';

/**
 * Home.
 *
 * One screen in both states — the header and the paste bar are constant, and
 * the middle is either the getting-started checklist or the lists themselves.
 *
 * The library and the lists live in component state for now. They move behind
 * the storage module when that lands (decision 28) — this is the only place
 * that holds either, so that swap touches one file. It is also why the builder
 * is a modal rather than its own route: a route would need the state to be
 * somewhere both screens can reach, which is the store's job and not a reason
 * to invent a context in the meantime.
 */
export default function HomeRoute() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [locating, setLocating] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  const [lists, setLists] = useState<List[]>([]);
  const [openListId, setOpenListId] = useState<string | null>(null);

  const openList = lists.find((l) => l.id === openListId) ?? null;

  /**
   * Two writes per spot, and that is not optional (decision 21): the row has to
   * appear the moment the link parses, so the geocoder runs after it is on
   * screen and patches it when it answers.
   */
  const add = async (spot: Spot) => {
    setSpots((current) => [...current, spot]);
    setLocating((current) => [...current, spot.id]);

    const filled = await fillInMissing(spot);
    if (filled) {
      setSpots((current) => current.map((s) => (s.id === filled.id ? filled : s)));
    }
    setLocating((current) => current.filter((id) => id !== spot.id));
  };

  const createList = () => {
    const list = emptyList();
    setLists((current) => [list, ...current]);
    setOpenListId(list.id);
  };

  const updateList = (next: List) =>
    setLists((current) => current.map((l) => (l.id === next.id ? next : l)));

  /** The note editor's default scope: words written once, in the library, and
   *  inherited by every list that has not overridden them. */
  const editSpot = (spotId: string, draft: NoteDraft) =>
    setSpots((current) =>
      current.map((s) =>
        s.id === spotId
          ? {
              ...s,
              title: draft.title.trim() === '' ? s.title : draft.title,
              shortNote: draft.shortNote.trim() === '' ? null : draft.shortNote,
              longNote: draft.longNote.trim() === '' ? null : draft.longNote,
              updatedAt: new Date().toISOString(),
            }
          : s,
      ),
    );

  const summaries: ListSummary[] = lists.map((list) => ({
    id: list.id,
    title: list.title,
    count: list.items.length,
    state: publishState(list, spots),
  }));

  return (
    <>
      <Home
        hasPlaces={spots.length > 0}
        lists={summaries}
        onPastePlace={() => setAdding(true)}
        onCreateList={createList}
        onOpenList={setOpenListId}
      />

      {openList ? (
        <ListBuilder
          visible
          list={openList}
          library={spots}
          onChange={updateList}
          onEditSpot={editSpot}
          // Nothing is published yet (todo.md sections 3, 4 and 7). This moves
          // the list into the published state and hands over a stand-in URL;
          // the screen says so rather than pretending.
          onPublish={() => updateList(markPublished(openList, spots))}
          onClose={() => setOpenListId(null)}
          onAddPlaces={() => setAdding(true)}
        />
      ) : null}

      <AddSpotsSheet
        visible={adding}
        spots={spots}
        locating={locating}
        onAdd={add}
        onClose={() => setAdding(false)}
      />
    </>
  );
}
