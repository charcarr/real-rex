import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addSpot, emptyList, overrideItem } from './lists.ts';
import { toRows } from './rows.ts';
import type { Spot } from './spots.ts';

const spot = (id: string, title: string, extra: Partial<Spot> = {}): Spot => ({
  id,
  title,
  address: null,
  latitude: null,
  longitude: null,
  placeRef: null,
  placeRefType: null,
  shortNote: 'A line about it.',
  longNote: null,
  googleMapsUrl: `https://maps.google.com/${id}`,
  needsGeocode: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...extra,
});

const library = [
  spot('a', 'Ramiro', { latitude: 38.7, longitude: -9.1, address: 'Lisbon' }),
  spot('b', 'Belem'),
  spot('c', 'Graca', { latitude: 38.72, longitude: null }),
];

const listOf = (...ids: string[]) => ids.reduce((l, id) => addSpot(l, id), emptyList('Lisbon'));

test('position is the order of the array, one-based', () => {
  assert.deepEqual(
    toRows(listOf('a', 'b', 'c'), library).map((r) => r.position),
    [1, 2, 3],
  );
});

test('the words are the resolved ones, so a list override is what gets sent', () => {
  const list = overrideItem(listOf('a'), 0, { shortNote: 'Different here.' });
  const [row] = toRows(list, library);

  assert.equal(row?.short_note, 'Different here.');
  assert.equal(row?.title, 'Ramiro', 'an untouched field still comes from the library');
});

test('coordinates are sent as a pair or not at all', () => {
  const [ramiro, belem, graca] = toRows(listOf('a', 'b', 'c'), library);

  assert.deepEqual([ramiro?.latitude, ramiro?.longitude], [38.7, -9.1]);
  assert.deepEqual([belem?.latitude, belem?.longitude], [null, null]);
  assert.deepEqual(
    [graca?.latitude, graca?.longitude],
    [null, null],
    'half a coordinate would fail list_item_latlng_together at the last moment',
  );
});

test('a spot missing from the library drops out rather than crashing', () => {
  const list = listOf('a', 'b');
  assert.equal(toRows(list, [library[0]!]).length, 1);
  assert.equal(toRows(list, [library[0]!])[0]?.position, 1, 'positions close up behind it');
});
