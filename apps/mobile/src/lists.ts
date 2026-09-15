import { MAX_SPOTS_PER_LIST } from '@real-rex/shared';

import { makeId } from './id.ts';
import type { Spot } from './spots.ts';

/**
 * The list model. Device-local, and pure -- nothing here touches storage,
 * the network or React, so all of it is testable without a simulator.
 *
 * Two things here are worth reading before changing anything.
 *
 * ORDER IS THE ARRAY. Decision 15 says `position` is a slot rather than a
 * ranking, and that the numeral shown is the row's rank, not a stored value.
 * On the device that reduces to: the array's order is the order, and nothing
 * stores a position at all. Positions get assigned once, at publish, when the
 * rows are written to Postgres.
 *
 * ITEMS ARE OVERRIDES, NOT COPIES -- YET. Decision 30 says a published
 * `list_item` carries its own copy of the words, so a published list is a
 * snapshot that a later library edit cannot rewrite. Its own preamble says
 * when the copy happens: "the note still lives in one place while you are
 * composing; it is copied when you publish." So while composing, an item
 * holds a spot id and only the fields where *this list* disagrees with the
 * library. Null means inherit. `resolve()` below is where the two meet, and
 * publishing is where the resolved values get frozen.
 *
 * That is what makes "library default, per-list override" true rather than
 * approximately true: edit the words in your library and every draft that has
 * not overridden them follows along, exactly as a default should.
 */

// ---------------------------------------------------------------------------
// The shape
// ---------------------------------------------------------------------------

/** A spot's place on a list, plus anything this list says differently. */
export interface ListItem {
  /** The library spot this row shows. */
  spotId: string;
  /** Null means "whatever the library says". A string means this list
   *  disagrees, and the library can change without touching this. */
  title: string | null;
  shortNote: string | null;
  longNote: string | null;
}

/** What was actually sent, the last time this list was published. */
export interface Publication {
  slug: string;
  url: string;
  /** When this list first went live. Null while it is unpublished -- the slug
   *  above is kept either way, so publishing again hands back the same link
   *  (decision 46). */
  publishedAt: string | null;
  /**
   * The fingerprint of the content at that moment. Comparing it against the
   * list's current fingerprint is what tells published apart from
   * published-with-unpublished-edits, without a dirty flag anyone can forget
   * to set -- and it gets this right in both directions: change a word and
   * change it back, and the list is not "edited".
   */
  fingerprint: string;
}

export interface List {
  id: string;
  title: string;
  /**
   * Where the list is, as the second question asked it. Null when skipped.
   *
   * Free text, not a geocoded place: it is enough to put a map under the
   * headline and to label it, and not enough to be accurate. A picker would
   * be a third question and a great deal more machinery.
   */
  place: string | null;
  description: string | null;
  /** Order is display order. Never longer than MAX_SPOTS_PER_LIST. */
  items: ListItem[];
  createdAt: string;
  updatedAt: string;
  /** Null until the first publish. Survives edits, renames and unpublishing:
   *  once a link exists it is this list's link forever. */
  published: Publication | null;
}

/**
 * The three states Charley named, derived rather than stored.
 *
 *   draft     never published; no URL exists
 *   published published, and what is on the page is what is in the app
 *   edited    published, then changed; the page is behind
 */
export type PublishState = 'draft' | 'published' | 'edited';

/** A spot resolved against its list item -- the words that will be published. */
export interface ResolvedItem {
  spot: Spot;
  title: string;
  shortNote: string | null;
  longNote: string | null;
  /** True where this list disagrees with the library, per field. */
  overridden: { title: boolean; shortNote: boolean; longNote: boolean };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

const now = (): string => new Date().toISOString();

const touch = (list: List): List => ({ ...list, updatedAt: now() });

export function emptyList(title = '', place: string | null = null): List {
  const t = now();
  return {
    id: makeId('list'),
    title,
    place: place !== null && place.trim() === '' ? null : place,
    description: null,
    items: [],
    createdAt: t,
    updatedAt: t,
    published: null,
  };
}

/**
 * An item against the library.
 *
 * Returns null when the spot is gone -- deleting a library spot has to be
 * survivable, and a list holding a dangling id must render as four rows and a
 * hole rather than crashing. Callers use `resolveAll`, which drops them.
 */
export function resolve(item: ListItem, library: readonly Spot[]): ResolvedItem | null {
  const spot = library.find((s) => s.id === item.spotId);
  if (!spot) return null;

  return {
    spot,
    title: item.title ?? spot.title,
    shortNote: item.shortNote ?? spot.shortNote,
    longNote: item.longNote ?? spot.longNote,
    overridden: {
      title: item.title !== null,
      shortNote: item.shortNote !== null,
      longNote: item.longNote !== null,
    },
  };
}

export const resolveAll = (list: List, library: readonly Spot[]): ResolvedItem[] =>
  list.items.map((item) => resolve(item, library)).filter((r): r is ResolvedItem => r !== null);

/**
 * Everything that would end up on the public page, in order, as one string.
 *
 * Resolved on purpose: editing a note in your library changes a published
 * page's content just as surely as editing it in the builder does, so it has
 * to count as an unpublished edit. Anything not on the page -- ids,
 * timestamps, coordinates the page does not show -- is left out, so touching
 * a list without changing what a reader sees does not mark it edited.
 */
export function fingerprint(list: List, library: readonly Spot[]): string {
  const rows = resolveAll(list, library).map((r) =>
    [r.title, r.shortNote ?? '', r.longNote ?? '', r.spot.googleMapsUrl].join(''),
  );
  return [list.title, list.description ?? '', ...rows].join('');
}

export function publishState(list: List, library: readonly Spot[]): PublishState {
  // A list that has been taken down keeps its slug but reads as a draft -- there
  // is nothing out there for it to be behind.
  if (!list.published || list.published.publishedAt === null) return 'draft';
  return list.published.fingerprint === fingerprint(list, library) ? 'published' : 'edited';
}

/** A list is publishable when it has a title and at least one spot. The cap is
 *  a ceiling, not a requirement -- three spots is a real list. */
export function canPublish(list: List): boolean {
  return list.title.trim().length > 0 && list.items.length > 0;
}

/** Spots not yet on this list, for the picker. */
export const availableSpots = (list: List, library: readonly Spot[]): Spot[] => {
  const taken = new Set(list.items.map((i) => i.spotId));
  return library.filter((s) => !taken.has(s.id));
};

export const isFull = (list: List): boolean => list.items.length >= MAX_SPOTS_PER_LIST;

// ---------------------------------------------------------------------------
// Writing. All of these return a new list; none mutate.
// ---------------------------------------------------------------------------

export const setTitle = (list: List, title: string): List => touch({ ...list, title });

export const setPlace = (list: List, place: string): List =>
  touch({ ...list, place: place.trim() === '' ? null : place });

export const setDescription = (list: List, description: string): List =>
  touch({ ...list, description: description.trim() === '' ? null : description });

/**
 * Put a spot in the next free slot.
 *
 * Refuses past the cap rather than silently trimming: decision 25 says the
 * sixth tap asks which of the five to replace, and that is a question only the
 * UI can ask. A duplicate is a no-op, not an error -- the spot is already
 * there, which is what the user wanted.
 */
export function addSpot(list: List, spotId: string): List {
  if (isFull(list)) return list;
  if (list.items.some((i) => i.spotId === spotId)) return list;

  return touch({
    ...list,
    items: [...list.items, { spotId, title: null, shortNote: null, longNote: null }],
  });
}

/** Swap one spot for another in place, keeping the slot. This is the answer to
 *  the sixth tap, and it deliberately drops the outgoing row's overrides --
 *  they were words about a different place. */
export function replaceAt(list: List, index: number, spotId: string): List {
  if (index < 0 || index >= list.items.length) return list;

  const items = [...list.items];
  items[index] = { spotId, title: null, shortNote: null, longNote: null };
  return touch({ ...list, items });
}

export function removeAt(list: List, index: number): List {
  if (index < 0 || index >= list.items.length) return list;
  return touch({ ...list, items: list.items.filter((_, i) => i !== index) });
}

/**
 * Move the row at `from` so that it sits at `to`.
 *
 * Splice out, then splice in. Doing it in that order is what makes `to` mean
 * the index in the *final* array, which is what a drag gesture reports -- the
 * alternative reads correctly for downward drags and is off by one for upward
 * ones.
 */
export function moveItem(list: List, from: number, to: number): List {
  const last = list.items.length - 1;
  if (from < 0 || from > last || to < 0 || to > last || from === to) return list;

  const items = [...list.items];
  const [moved] = items.splice(from, 1);
  if (!moved) return list;
  items.splice(to, 0, moved);
  return touch({ ...list, items });
}

/** Write this list's own words for one row. Empty clears the override and the
 *  row goes back to inheriting from the library. */
export function overrideItem(
  list: List,
  index: number,
  fields: Partial<Pick<ListItem, 'title' | 'shortNote' | 'longNote'>>,
): List {
  const current = list.items[index];
  if (!current) return list;

  const clean = (v: string | null | undefined): string | null | undefined =>
    typeof v === 'string' && v.trim() === '' ? null : v;

  const items = [...list.items];
  items[index] = {
    ...current,
    ...(fields.title !== undefined ? { title: clean(fields.title) ?? null } : {}),
    ...(fields.shortNote !== undefined ? { shortNote: clean(fields.shortNote) ?? null } : {}),
    ...(fields.longNote !== undefined ? { longNote: clean(fields.longNote) ?? null } : {}),
  };
  return touch({ ...list, items });
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

/**
 * Where a published list lives.
 *
 * The host is a placeholder until `apps/web` is deployed. Decision 37's rule is
 * that the app must not hand out a link it knows is a lie, and a host that is
 * obviously not ours reads as unfinished rather than broken -- while the slug
 * beneath it is real, so the shape being reviewed is the shape that ships.
 * Deploying the site changes one constant.
 */
export const PUBLIC_BASE_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://abc.com';

export const publicUrl = (slug: string): string => `${PUBLIC_BASE_URL}/l/${slug}`;

/**
 * Stands in for the database's `build_slug()` until publishing is real.
 *
 * Deliberately the same shape -- a folded title and twelve hex characters --
 * so the link on screen now is the link that will be on screen later. This is
 * the one place the device copies a rule that belongs to Postgres, and it goes
 * away the moment an insert answers with the real one.
 */
function stubSlug(title: string): string {
  const folded = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');

  const hex = Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join(
    '',
  );

  return `${folded === '' ? 'list' : folded}-${hex}`;
}

/**
 * Put the list out there, as of now.
 *
 * The slug is minted once and kept forever after -- through edits, through
 * renames, and through unpublishing (decision 46). `publishedAt` means when the
 * version that is live now went up, so publishing edits moves it: what a reader
 * is looking at is the thing worth dating, and it is what the sheet needs in
 * order to say how old the live page is.
 *
 * The fingerprint is taken here, from the same library the page was rendered
 * from, which is what makes "edited" honest afterwards.
 */
export function markPublished(list: List, library: readonly Spot[]): List {
  const slug = list.published?.slug ?? stubSlug(list.title);

  return touch({
    ...list,
    published: {
      slug,
      url: publicUrl(slug),
      publishedAt: now(),
      fingerprint: fingerprint(list, library),
    },
  });
}

/**
 * Take the page down, and keep the link.
 *
 * Decision 46: unpublishing is the reversible one. The row survives, so
 * publishing again hands back the same URL rather than a new one. Deleting the
 * list is the door that closes.
 */
export function unpublish(list: List): List {
  if (!list.published) return list;
  return touch({ ...list, published: { ...list.published, publishedAt: null } });
}
