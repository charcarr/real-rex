import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DOCUMENT_KEY,
  DOCUMENT_VERSION,
  QUARANTINE_KEY,
  emptyDocument,
  parseDocument,
  readDocument,
  writeDocument,
  type Backend,
} from './document.ts';
import { emptyList } from './lists.ts';
import type { Spot } from './spots.ts';

/** MMKV's surface, as far as the document is concerned. */
function fake(seed: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(seed));
  const backend: Backend = {
    getString: (key) => store.get(key),
    set: (key, value) => {
      store.set(key, value);
    },
  };
  return { backend, store };
}

const spot = (id: string): Spot => ({
  id,
  title: 'Cafe Gitane',
  address: null,
  latitude: null,
  longitude: null,
  placeRef: null,
  placeRefType: null,
  shortNote: null,
  longNote: null,
  googleMapsUrl: `https://maps.google.com/?q=${id}`,
  needsGeocode: false,
  createdAt: '2026-09-14T00:00:00.000Z',
  updatedAt: '2026-09-14T00:00:00.000Z',
});

test('a device with nothing on it opens an empty document', () => {
  const { backend } = fake();
  assert.deepEqual(readDocument(backend), emptyDocument());
});

test('a document survives a round trip', () => {
  const { backend } = fake();
  const written = {
    version: DOCUMENT_VERSION,
    spots: [spot('a'), spot('b')],
    lists: [emptyList('Lisbon')],
  };

  writeDocument(backend, written);

  assert.deepEqual(readDocument(backend), written);
});

test('the version is stamped by the writer, not taken from the caller', () => {
  const { backend, store } = fake();

  writeDocument(backend, { version: 99, spots: [], lists: [] });

  assert.equal(JSON.parse(store.get(DOCUMENT_KEY)!).version, DOCUMENT_VERSION);
});

test('bytes we cannot read are quarantined, not thrown away', () => {
  const { backend, store } = fake({ [DOCUMENT_KEY]: '{"spots":[{"id":"a"' });

  assert.deepEqual(readDocument(backend), emptyDocument());
  assert.equal(store.get(QUARANTINE_KEY), '{"spots":[{"id":"a"');
});

test('an unreadable document is quarantined once, not on every launch', () => {
  const { backend, store } = fake({ [DOCUMENT_KEY]: 'not json at all' });

  readDocument(backend);
  // The second read finds the replacement, so it has nothing to quarantine and
  // cannot overwrite the only copy of the bad bytes.
  store.set(DOCUMENT_KEY, store.get(DOCUMENT_KEY)!);
  assert.deepEqual(readDocument(backend), emptyDocument());

  assert.equal(store.get(QUARANTINE_KEY), 'not json at all');
});

test('a document from a newer version of the app is not guessed at', () => {
  const newer = JSON.stringify({ version: DOCUMENT_VERSION + 1, spots: [], lists: [] });
  const { backend, store } = fake({ [DOCUMENT_KEY]: newer });

  assert.deepEqual(readDocument(backend), emptyDocument());
  assert.equal(store.get(QUARANTINE_KEY), newer);
});

test('records of the wrong shape make the document unreadable', () => {
  for (const bad of [
    '{"version":1,"spots":"nope","lists":[]}',
    '{"version":1,"spots":[{"title":"no id"}],"lists":[]}',
    '{"version":1,"spots":[],"lists":[[]]}',
    '{"version":1,"spots":[]}',
  ]) {
    assert.equal(parseDocument(bad).kind, 'unreadable', bad);
  }
});

test('empty is told apart from unreadable', () => {
  // Nothing stored is the normal first launch. Something stored that we cannot
  // read is a bug, and the two must not share a code path.
  assert.equal(parseDocument(undefined).kind, 'empty');
  assert.equal(parseDocument('').kind, 'empty');
  assert.equal(parseDocument('null').kind, 'unreadable');
  assert.equal(parseDocument('[]').kind, 'unreadable');
  assert.equal(parseDocument('{"spots":[],"lists":[]}').kind, 'unreadable');
});
