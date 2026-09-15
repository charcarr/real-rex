import type { List, RemotePublication } from './lists.ts';
import { toRows } from './rows.ts';
import type { Spot } from './spots.ts';
import { supabase } from './supabase.ts';

/**
 * Putting a list on the internet, and taking it off again.
 *
 * Decision 46 is the whole model: `published_at` is the only thing making a
 * list public, and the live items are the rows at the highest version. So
 * publishing an edit is an insert -- one statement, which lands whole -- and a
 * reader never sees half a list without a transaction being involved anywhere.
 *
 * Decision 33 is why this is here rather than in Postgres: it is the most
 * important logic in the product, and it should be somewhere you can read it,
 * step through it, and see it in a diff.
 *
 * EVERYTHING HERE IS SAFE TO RETRY, which is what lets the sheet's failure
 * state be a single line offering to try again:
 *
 *   - the list row upserts on `client_ref`, so a lost response cannot leave
 *     two lists;
 *   - items go to a version nobody has used, so a half-written publish is
 *     invisible and the next attempt simply writes the next number;
 *   - the device records a publication only after the server confirms one, so
 *     the app can understate what is live but never overstate it.
 */

/**
 * Stop waiting after fifteen seconds.
 *
 * This does not cancel the request; it stops the spinner spinning forever on a
 * connection that went away without closing. A publish that lands after we gave
 * up is harmless -- the retry writes one more version of the same content.
 */
const TIMEOUT_MS = 15_000;

function withTimeout<T>(work: PromiseLike<T>, step: string): Promise<T> {
  return Promise.race([
    Promise.resolve(work),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${step} timed out`)), TIMEOUT_MS),
    ),
  ]);
}

type Result<T> = { data: T | null; error: { message: string; code?: string } | null };

/**
 * One request.
 *
 * The person is told one thing -- that it did not go through -- because that is
 * the only thing they can act on. The detail goes to the console, which is
 * where PostHog error tracking will pick it up (todo 5).
 */
async function run<T>(step: string, query: PromiseLike<Result<T>>): Promise<T | null> {
  const { data, error } = await withTimeout(query, step);

  if (error) {
    console.warn(`[publish] ${step}: ${error.code ?? ''} ${error.message}`.trim());
    throw new Error(step);
  }

  return data;
}

/**
 * Decision 29: no auth user exists until someone publishes, and at that moment
 * they publish anonymously. The sign-in choice lands here when Apple does.
 */
async function ensureSession(): Promise<void> {
  const db = supabase();

  const { data } = await withTimeout(db.auth.getSession(), 'session');
  if (data.session) return;

  const { error } = await withTimeout(db.auth.signInAnonymously(), 'sign-in');
  if (error) {
    console.warn(`[publish] sign-in: ${error.message}`);
    throw new Error('sign-in');
  }
}

type ListRow = { id: number; slug: string };

/**
 * The row this device's list corresponds to, creating it if this is the first
 * send.
 *
 * `client_ref` is the device's own id for the list and carries a unique
 * constraint, so a create that succeeded but whose response was lost comes back
 * as `23505` rather than as a second list with a second URL. That case is
 * handled by looking again, which is the whole reason the constraint exists.
 */
async function listRow(list: List): Promise<ListRow> {
  const db = supabase();

  const found = await run<ListRow>(
    'find list',
    db.from('list').select('id, slug').eq('client_ref', list.id).maybeSingle(),
  );
  if (found) return found;

  const { data, error } = await withTimeout(
    db
      .from('list')
      .insert({ client_ref: list.id, title: list.title, place: list.place })
      .select('id, slug')
      .single(),
    'create list',
  );

  if (data) return data as ListRow;

  if (error?.code === '23505') {
    const existing = await run<ListRow>(
      'find list again',
      db.from('list').select('id, slug').eq('client_ref', list.id).maybeSingle(),
    );
    if (existing) return existing;
  }

  console.warn(`[publish] create list: ${error?.code ?? ''} ${error?.message ?? ''}`.trim());
  throw new Error('create list');
}

/** The next version nobody has written. Read rather than remembered, so an
 *  interrupted publish needs no repair -- the next one takes the next number. */
async function nextVersion(listId: number): Promise<number> {
  const latest = await run<{ version: number }>(
    'read version',
    supabase()
      .from('list_item')
      .select('version')
      .eq('list_id', listId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
  );

  return (latest?.version ?? 0) + 1;
}

export async function publishList(
  list: List,
  library: readonly Spot[],
): Promise<RemotePublication> {
  await ensureSession();

  const db = supabase();
  const row = await listRow(list);
  const version = await nextVersion(row.id);

  // One statement, so the five rows land together or not at all. This is the
  // publish: from here the newest version is what a reader sees.
  await run(
    'write items',
    db
      .from('list_item')
      .insert(toRows(list, library).map((r) => ({ ...r, list_id: row.id, version }))),
  );

  // Carries a rename up with it, and dates the version that just went live.
  const published = await run<{ slug: string; published_at: string }>(
    'publish',
    db
      .from('list')
      .update({
        title: list.title,
        place: list.place,
        published_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .select('slug, published_at')
      .single(),
  );

  if (!published) throw new Error('publish');

  return { slug: published.slug, publishedAt: published.published_at };
}

/**
 * Take the page down and keep the link (decision 46). The row survives, so the
 * slug does, and sending again lights the same URL back up.
 */
export async function unpublishList(list: List): Promise<void> {
  await ensureSession();

  await run(
    'unpublish',
    supabase().from('list').update({ published_at: null }).eq('client_ref', list.id),
  );
}
