import type { List } from './lists.ts';
import type { Spot } from './spots.ts';

/**
 * The device document -- everything the app knows, as one value.
 *
 * Decision 28: the device is the source of truth until publish, and what it
 * holds is a single versioned JSON document rather than a database. A few
 * hundred spots do not need a query planner, and one document means one write,
 * so there is no such thing as a half-saved library.
 *
 * NOTHING HERE IMPORTS MMKV, REACT, OR ANYTHING NATIVE. The caller passes a
 * `Backend` in. That is why every line below runs under `node --test` with a
 * Map standing in, and why changing the storage engine later touches exactly
 * one file, which is not this one.
 */

/** Bump when the shape below changes, and add a step to `migrate`. */
export const DOCUMENT_VERSION = 2;

export interface StoredDocument {
  version: number;
  spots: Spot[];
  lists: List[];
}

/** The least a key-value store has to do for us. MMKV satisfies this
 *  structurally, and so does a Map. */
export interface Backend {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
}

export const DOCUMENT_KEY = 'realrex.document';
/** Where a document we could not read goes instead of being thrown away. */
export const QUARANTINE_KEY = 'realrex.document.unreadable';

export const emptyDocument = (): StoredDocument => ({
  version: DOCUMENT_VERSION,
  spots: [],
  lists: [],
});

export type ParseResult =
  | { kind: 'ok'; document: StoredDocument }
  | { kind: 'empty' }
  | { kind: 'unreadable'; reason: string };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Records are checked at the top level and by id, and no further.
 *
 * A deeper validator would be a second copy of the types, maintained by hand,
 * guarding against a writer that is only ever us. What this does catch is what
 * actually happens: a truncated write, a foreign value under our key, or a
 * document written by a version of the app we do not understand.
 */
const looksLikeRecords = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.every((entry) => isObject(entry) && typeof entry.id === 'string' && entry.id !== '');

export function parseDocument(raw: string | undefined): ParseResult {
  if (raw === undefined || raw === '') return { kind: 'empty' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: 'unreadable', reason: 'not JSON' };
  }

  if (!isObject(parsed)) return { kind: 'unreadable', reason: 'not an object' };
  if (typeof parsed.version !== 'number' || !Number.isInteger(parsed.version)) {
    return { kind: 'unreadable', reason: 'no version' };
  }

  // A document from a LATER version of the app -- a TestFlight rollback, or a
  // downgrade. Today's rules would misread fields written under rules we do
  // not have, and misreading someone's library is worse than declining to read
  // it: quarantine keeps the bytes, a bad parse silently rewrites them.
  if (parsed.version > DOCUMENT_VERSION) {
    return {
      kind: 'unreadable',
      reason: `version ${parsed.version} is newer than ${DOCUMENT_VERSION}`,
    };
  }

  if (!looksLikeRecords(parsed.spots)) return { kind: 'unreadable', reason: 'spots' };
  if (!looksLikeRecords(parsed.lists)) return { kind: 'unreadable', reason: 'lists' };

  return {
    kind: 'ok',
    document: migrate({
      version: parsed.version,
      spots: parsed.spots as Spot[],
      lists: parsed.lists as List[],
    }),
  };
}

/**
 * One step per version, in order.
 *
 * 1 -> 2. Publishing was stubbed (decision 37), so a list from version 1 can be
 * carrying a slug and a URL that were never real -- the app would show a link
 * that 404s and a row that says Public about a page nobody can open. Clearing
 * `published` puts those lists back to drafts, and the next send is a real
 * first publish.
 */
function migrate(document: StoredDocument): StoredDocument {
  let lists = document.lists;

  if (document.version < 2) {
    lists = lists.map((list) => (list.published ? { ...list, published: null } : list));
  }

  return { ...document, lists, version: DOCUMENT_VERSION };
}

export function readDocument(backend: Backend): StoredDocument {
  const raw = backend.getString(DOCUMENT_KEY);
  const result = parseDocument(raw);

  if (result.kind === 'ok') return result.document;

  if (result.kind === 'unreadable' && raw !== undefined) {
    // Keep the bytes. A document we cannot read is both a bug in us and the
    // only copy of someone's library; overwriting it destroys the evidence and
    // their spots in the same move.
    backend.set(QUARANTINE_KEY, raw);
    // Then replace it, so the same unreadable bytes are not re-quarantined on
    // every launch from here on. The copy above is the one that matters.
    writeDocument(backend, emptyDocument());
  }

  return emptyDocument();
}

export function writeDocument(backend: Backend, document: StoredDocument): void {
  // The version is stamped here rather than trusted from the caller, so a
  // stored document can never claim a version it was not written by.
  backend.set(DOCUMENT_KEY, JSON.stringify({ ...document, version: DOCUMENT_VERSION }));
}
