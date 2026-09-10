import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addSpot,
  canPublish,
  emptyList,
  fingerprint,
  markPublished,
  moveItem,
  overrideItem,
  publishState,
  removeAt,
  replaceAt,
  resolve,
  resolveAll,
  setDescription,
  type List,
} from './lists.ts';
import type { Spot } from './spots.ts';

/** A library spot with only the fields the list model reads. */
const spot = (id: string, title: string, shortNote: string | null = null): Spot => ({
  id,
  title,
  address: null,
  latitude: null,
  longitude: null,
  placeRef: null,
  placeRefType: null,
  shortNote,
  longNote: null,
  googleMapsUrl: `https://maps.google.com/${id}`,
  needsGeocode: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const library = [spot('a', 'Ramiro', 'The garlic prawns.'), spot('b', 'Belem'), spot('c', 'Graca')];

/** A list of the given library spots, in order. */
const listOf = (...ids: string[]): List =>
  ids.reduce((l, id) => addSpot(l, id), { ...emptyList('Lisbon') });

const ids = (l: List): string[] => l.items.map((i) => i.spotId);

// ---------------------------------------------------------------------------
// Order
// ---------------------------------------------------------------------------

test('moveItem is correct in both directions', () => {
  const l = listOf('a', 'b', 'c');

  // Downwards: the first row ends up last.
  assert.deepEqual(ids(moveItem(l, 0, 2)), ['b', 'c', 'a']);
  // Upwards: the last row ends up first. This is the case that an
  // insert-before-remove implementation gets wrong by one.
  assert.deepEqual(ids(moveItem(l, 2, 0)), ['c', 'a', 'b']);
  // Adjacent swap, both ways.
  assert.deepEqual(ids(moveItem(l, 0, 1)), ['b', 'a', 'c']);
  assert.deepEqual(ids(moveItem(l, 1, 0)), ['b', 'a', 'c']);
});

test('moveItem leaves the list alone when the move is a no-op or out of range', () => {
  const l = listOf('a', 'b', 'c');
  assert.equal(moveItem(l, 1, 1), l);
  assert.equal(moveItem(l, -1, 0), l);
  assert.equal(moveItem(l, 0, 3), l);
});

test('a move round trip restores the original order', () => {
  const l = listOf('a', 'b', 'c');
  assert.deepEqual(ids(moveItem(moveItem(l, 0, 2), 2, 0)), ['a', 'b', 'c']);
});

// ---------------------------------------------------------------------------
// The cap
// ---------------------------------------------------------------------------

test('the fifth spot fits and the sixth is refused', () => {
  const five = ['a', 'b', 'c', 'd', 'e'].reduce((l, id) => addSpot(l, id), emptyList('Five'));
  assert.equal(five.items.length, 5);

  const sixth = addSpot(five, 'f');
  assert.equal(sixth, five, 'a sixth spot must not be appended -- the UI asks what it replaces');
});

test('adding a spot that is already on the list changes nothing', () => {
  const l = listOf('a', 'b');
  assert.equal(addSpot(l, 'a'), l);
});

test('replaceAt keeps the slot and drops the outgoing words', () => {
  const l = overrideItem(listOf('a', 'b'), 0, { shortNote: 'Mine' });
  const swapped = replaceAt(l, 0, 'c');

  assert.deepEqual(ids(swapped), ['c', 'b']);
  assert.equal(swapped.items[0]?.shortNote, null);
});

// ---------------------------------------------------------------------------
// Overrides
// ---------------------------------------------------------------------------

test('a row with no override inherits the library, and follows it when it changes', () => {
  const l = listOf('a');
  assert.equal(resolve(l.items[0]!, library)?.shortNote, 'The garlic prawns.');

  const edited = [spot('a', 'Ramiro', 'Different words now.')];
  assert.equal(resolve(l.items[0]!, edited)?.shortNote, 'Different words now.');
});

test('an override wins, and clearing it goes back to inheriting', () => {
  const l = overrideItem(listOf('a'), 0, { shortNote: 'Quiet at lunchtime' });
  const r = resolve(l.items[0]!, library);
  assert.equal(r?.shortNote, 'Quiet at lunchtime');
  assert.equal(r?.overridden.shortNote, true);

  const cleared = overrideItem(l, 0, { shortNote: '   ' });
  assert.equal(cleared.items[0]?.shortNote, null, 'whitespace is not an override');
  assert.equal(resolve(cleared.items[0]!, library)?.shortNote, 'The garlic prawns.');
});

test('a row whose library spot is gone is dropped rather than crashing', () => {
  const l = listOf('a', 'b');
  const withoutA = library.filter((s) => s.id !== 'a');
  assert.deepEqual(
    resolveAll(l, withoutA).map((r) => r.spot.id),
    ['b'],
  );
});

// ---------------------------------------------------------------------------
// The three states
// ---------------------------------------------------------------------------

test('a list starts as a draft', () => {
  assert.equal(publishState(listOf('a'), library), 'draft');
});

test('publishing makes it published, and editing it makes it edited', () => {
  const published = markPublished(listOf('a', 'b'), library);
  assert.equal(publishState(published, library), 'published');

  assert.equal(publishState(setDescription(published, 'Some words'), library), 'edited');
  assert.equal(publishState(removeAt(published, 1), library), 'edited');
  assert.equal(publishState(moveItem(published, 0, 1), library), 'edited');
  assert.equal(
    publishState(overrideItem(published, 0, { shortNote: 'New' }), library),
    'edited',
    'changing the words for this list is an edit',
  );
});

test('editing the library behind a published list marks it edited', () => {
  const published = markPublished(listOf('a'), library);
  const edited = [spot('a', 'Ramiro', 'Rewritten in the library.'), ...library.slice(1)];

  assert.equal(
    publishState(published, edited),
    'edited',
    'an inherited note is on the page, so changing it changes the page',
  );
});

test('an edit and its undo leave the list published, not edited', () => {
  const published = markPublished(listOf('a'), library);
  const there = setDescription(published, 'Some words');
  const back = setDescription(there, '');

  assert.equal(publishState(there, library), 'edited');
  assert.equal(publishState(back, library), 'published');
});

test('republishing clears the edit and keeps the slug', () => {
  const published = markPublished(listOf('a'), library);
  const again = markPublished(setDescription(published, 'Some words'), library);

  assert.equal(publishState(again, library), 'published');
  assert.equal(again.published?.slug, published.published?.slug, 'the URL you sent must not move');
});

test('the fingerprint ignores what the page does not show', () => {
  const l = listOf('a');
  const before = fingerprint(l, library);
  // A geocoder patch that fills in coordinates changes the library spot but
  // not a word on the page.
  const located = [{ ...library[0]!, latitude: 38.7, longitude: -9.1, needsGeocode: false }];
  assert.equal(fingerprint(l, located), before);
});

// ---------------------------------------------------------------------------
// Publishability
// ---------------------------------------------------------------------------

test('a list needs a title and at least one spot', () => {
  assert.equal(canPublish(emptyList('')), false);
  assert.equal(canPublish(emptyList('Lisbon')), false, 'a title alone is not a list');
  assert.equal(canPublish(listOf('a')), true, 'one spot is a real list; five is a ceiling');
  assert.equal(canPublish({ ...listOf('a'), title: '   ' }), false);
});
