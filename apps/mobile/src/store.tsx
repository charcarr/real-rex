import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { fillInMissing } from './geocode';
import { emptyList, type List } from './lists';
import type { Spot } from './spots';

/**
 * Everything the app knows, for as long as the app is open.
 *
 * IN MEMORY, ON PURPOSE, FOR NOW. Nothing here survives a reload, and that is
 * the agreed order of work: get making and maintaining a list right, then put
 * it in MMKV behind the storage module (decision 28), then publish. When that
 * lands it replaces the two `useState` calls below and nothing else -- every
 * screen already asks this file rather than holding state of its own.
 *
 * It is a context rather than props because the builder is a route now and
 * not a modal. Four screens read and write the same two collections, and a
 * route cannot be handed props by the screen that pushed it.
 */

type Store = {
  /** The library: every place you have ever added. */
  spots: Spot[];
  /** Your lists, newest first. */
  lists: List[];
  /** Spot ids whose coordinates are still being worked out. */
  locating: string[];

  capture: (spot: Spot) => Promise<void>;
  /** Write words to the library, where every list that has not overridden
   *  them will pick them up. */
  writeSpot: (spotId: string, notes: { shortNote: string; longNote: string }) => void;
  createList: (title: string, place: string | null) => List;
  updateList: (next: List) => void;
  listById: (id: string | undefined) => List | null;
};

const Context = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [locating, setLocating] = useState<string[]>([]);

  /**
   * Two writes per spot, and that is not optional (decision 21): the row has
   * to appear the moment the link parses, so the geocoder runs after it is on
   * screen and patches it when it answers.
   */
  const capture = useCallback(async (spot: Spot) => {
    setSpots((current) => [...current, spot]);
    setLocating((current) => [...current, spot.id]);

    const filled = await fillInMissing(spot);
    if (filled) setSpots((current) => current.map((s) => (s.id === filled.id ? filled : s)));

    setLocating((current) => current.filter((id) => id !== spot.id));
  }, []);

  const writeSpot = useCallback(
    (spotId: string, notes: { shortNote: string; longNote: string }) =>
      setSpots((current) =>
        current.map((s) =>
          s.id === spotId
            ? {
                ...s,
                shortNote: notes.shortNote.trim() === '' ? null : notes.shortNote,
                longNote: notes.longNote.trim() === '' ? null : notes.longNote,
                updatedAt: new Date().toISOString(),
              }
            : s,
        ),
      ),
    [],
  );

  const createList = useCallback((title: string, place: string | null) => {
    const list = emptyList(title, place);
    setLists((current) => [list, ...current]);
    return list;
  }, []);

  const updateList = useCallback(
    (next: List) => setLists((current) => current.map((l) => (l.id === next.id ? next : l))),
    [],
  );

  const value = useMemo<Store>(
    () => ({
      spots,
      lists,
      locating,
      capture,
      writeSpot,
      createList,
      updateList,
      listById: (id) => (id ? (lists.find((l) => l.id === id) ?? null) : null),
    }),
    [spots, lists, locating, capture, writeSpot, createList, updateList],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useStore(): Store {
  const store = useContext(Context);
  if (!store) throw new Error('useStore was called outside StoreProvider');
  return store;
}
