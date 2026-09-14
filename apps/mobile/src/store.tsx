import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { DOCUMENT_VERSION } from './document';
import { fillInMissing } from './geocode';
import { emptyList, type List } from './lists';
import type { Spot } from './spots';
import { loadDocument, saveDocument } from './storage';

/**
 * Everything the app knows.
 *
 * Backed by the device document (decision 28): the two collections below are
 * read synchronously at mount and written back whenever either of them
 * changes. That is the whole of persistence, and it stayed the one-file change
 * it was promised to be -- every screen already asks this file rather than
 * holding state of its own.
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
  // Read once, synchronously, before the first render. This is the entire
  // reason for MMKV over AsyncStorage: there is no gap between mounting and
  // having the library, so there is no empty state to cover up.
  const [loaded] = useState(loadDocument);
  const [spots, setSpots] = useState<Spot[]>(loaded.spots);
  const [lists, setLists] = useState<List[]>(loaded.lists);
  /** Deliberately not persisted: a spot interrupted mid-geocode should come
   *  back as "not located yet", never as "still locating". */
  const [locating, setLocating] = useState<string[]>([]);

  const hasLoaded = useRef(false);
  useEffect(() => {
    // Skip the write that would otherwise immediately follow the read.
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      return;
    }
    saveDocument({ version: DOCUMENT_VERSION, spots, lists });
  }, [spots, lists]);

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
