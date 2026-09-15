#!/usr/bin/env node
//
// Proves the publish path against a real Supabase, before a line of it exists
// in the app. No dependencies -- raw fetch against GoTrue and PostgREST, so
// what runs here is exactly what the device will send.
//
// The model under test:
//
//   published_at is the switch -- set means live, null means dark.
//   The live items are the rows at the HIGHEST version.
//   Publishing edits is one insert. The link never moves.
//   The database enforces ownership and the five-spot cap, and nothing else.
//
// Run:
//
//     SUPABASE_URL=https://xxx.supabase.co SUPABASE_PUBLISHABLE_KEY=... \
//       node scripts/publish-smoke.mjs
//
// Anonymous sign-ins must be enabled on the target, and `list` and `list_item`
// must be exposed through the Data API -- a table that is not returns 404 no
// matter what its grants and policies say.

const URL_BASE = process.env.SUPABASE_URL ?? process.env.API_URL ?? 'http://127.0.0.1:54321';
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.ANON_KEY;

if (!KEY) {
  console.error('Set SUPABASE_PUBLISHABLE_KEY (or ANON_KEY). See the header of this file.');
  process.exit(2);
}

let failures = 0;
const ok = (cond, label, detail) => {
  console.log(`${cond ? 'PASS ' : 'FAIL '} ${label}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log(`       ${JSON.stringify(detail)}`);
  }
};

async function api(path, { method = 'GET', token, body, prefer } = {}) {
  const res = await fetch(`${URL_BASE}${path}`, {
    method,
    headers: {
      apikey: KEY,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text === '' ? null : { raw: text }; }
  return { status: res.status, json };
}

const REPRESENTATION = 'return=representation';

/** Five spots, as the device would marshal them for one version. */
const itemsAt = (listId, version, firstTitle) =>
  ['Time Out Market', 'Pasteis de Belem', 'Miradouro da Graca', 'A Ginjinha', 'Cervejaria Ramiro']
    .map((title, i) => ({
      list_id: listId,
      version,
      position: i + 1,
      title: i === 0 ? firstTitle : title,
      short_note: `Note for ${title}`,
      long_note: i === 0 ? 'We go here after work on Wednesdays.' : null,
      google_maps_url: `https://maps.app.goo.gl/smoke-${i + 1}`,
    }));

console.log(`\nTarget: ${URL_BASE}\n`);

// ---------------------------------------------------------------------------
// 1. Identity. Decision 29: no user exists until someone publishes.
// ---------------------------------------------------------------------------

const anon = await api('/auth/v1/signup', { method: 'POST', body: {} });
if (anon.status !== 200) {
  console.error('Anonymous sign-in failed. Is it enabled on this project?');
  console.error(anon.status, JSON.stringify(anon.json, null, 2));
  process.exit(1);
}
const token = anon.json.access_token;
ok(!!token, 'anonymous sign-in');

// ---------------------------------------------------------------------------
// 2. The first send: create the list, then its five items, then light it up.
// ---------------------------------------------------------------------------

const clientRef = `smoke-${Date.now().toString(36)}`;
const created = await api('/rest/v1/list', {
  method: 'POST',
  token,
  prefer: REPRESENTATION,
  body: { client_ref: clientRef, title: 'Lisbon in two days', place: 'Lisbon' },
});
ok(created.status === 201, `list insert returned ${created.status}`, created.json);

const list = Array.isArray(created.json) ? created.json[0] : created.json;
const listId = list?.id;
const slug = list?.slug;
ok(!!listId, `list created, id ${listId}`);
ok(/^lisbon-in-two-days-[0-9a-f]{12}$/.test(slug ?? ''), `slug minted by the trigger: ${slug}`);
ok(list?.published_at === null, 'a new list is not public until published_at is set');

const v1 = await api('/rest/v1/list_item', {
  method: 'POST', token, prefer: REPRESENTATION, body: itemsAt(listId, 1, 'Time Out Market'),
});
ok(v1.status === 201 && v1.json?.length === 5, `five items at version 1 (${v1.status})`, v1.json);

const lit = await api(`/rest/v1/list?id=eq.${listId}`, {
  method: 'PATCH', token, prefer: REPRESENTATION,
  body: { published_at: new Date().toISOString() },
});
ok(lit.status === 200 && lit.json?.[0]?.published_at, 'published_at set -- the list is live');

// ---------------------------------------------------------------------------
// 3. Publishing edits. One insert, and the newest version wins.
// ---------------------------------------------------------------------------

const v2 = await api('/rest/v1/list_item', {
  method: 'POST', token, prefer: REPRESENTATION, body: itemsAt(listId, 2, 'Time Out Market (edited)'),
});
ok(v2.status === 201, `five items at version 2 (${v2.status})`, v2.json);

const all = await api(`/rest/v1/list_item?list_id=eq.${listId}&select=version,position,title&order=version.desc,position.asc`, { token });
const newest = Math.max(...(all.json ?? []).map((r) => r.version));
const live = (all.json ?? []).filter((r) => r.version === newest);
ok(newest === 2, `the newest version is ${newest}`);
ok(live.length === 5, 'the live version has five rows');
ok(live.find((r) => r.position === 1)?.title === 'Time Out Market (edited)', 'the edit is what is live');

const after = await api(`/rest/v1/list?id=eq.${listId}&select=slug,published_at`, { token });
ok(after.json?.[0]?.slug === slug, 'publishing edits did not move the link');

// ---------------------------------------------------------------------------
// 4. The cap, and the columns the client must not be able to write.
// ---------------------------------------------------------------------------

const sixth = await api('/rest/v1/list_item', {
  method: 'POST', token,
  body: { list_id: listId, version: 3, position: 6, title: 'A sixth spot',
          google_maps_url: 'https://maps.app.goo.gl/smoke-6' },
});
ok(sixth.status >= 400, `a sixth spot is refused by the database (${sixth.status})`);

const hijack = await api(`/rest/v1/list?id=eq.${listId}`, {
  method: 'PATCH', token, body: { slug: 'stolen-slug' },
});
ok(hijack.status >= 400, `the client cannot write the slug (${hijack.status})`);

const rename = await api(`/rest/v1/list?id=eq.${listId}`, {
  method: 'PATCH', token, prefer: REPRESENTATION, body: { title: 'Lisbon, properly' },
});
ok(rename.status === 200, `renaming a list is allowed (${rename.status})`);
ok(rename.json?.[0]?.slug === slug, 'renaming does not move the link either');

// ---------------------------------------------------------------------------
// 5. Unpublish keeps the link; publishing again brings the same URL back.
// ---------------------------------------------------------------------------

const dark = await api(`/rest/v1/list?id=eq.${listId}`, {
  method: 'PATCH', token, prefer: REPRESENTATION, body: { published_at: null },
});
ok(dark.status === 200 && dark.json?.[0]?.published_at === null, 'unpublished');
ok(dark.json?.[0]?.slug === slug, 'the link is kept while the list is dark');

const relit = await api(`/rest/v1/list?id=eq.${listId}`, {
  method: 'PATCH', token, prefer: REPRESENTATION,
  body: { published_at: new Date().toISOString() },
});
ok(relit.json?.[0]?.slug === slug, 'publishing again hands back the same link');

// ---------------------------------------------------------------------------
// 6. A dropped response must not leave a duplicate list.
// ---------------------------------------------------------------------------

const again = await api('/rest/v1/list', {
  method: 'POST', token, body: { client_ref: clientRef, title: 'Lisbon in two days' },
});
ok(again.status === 409, `the same client_ref cannot create a second list (${again.status})`);

// ---------------------------------------------------------------------------
// 7. Delete takes the items with it. This is the permanent one.
// ---------------------------------------------------------------------------

const gone = await api(`/rest/v1/list?id=eq.${listId}`, { method: 'DELETE', token });
ok(gone.status === 204 || gone.status === 200, `list deleted (${gone.status})`);

const orphans = await api(`/rest/v1/list_item?list_id=eq.${listId}&select=id`, { token });
ok(Array.isArray(orphans.json) && orphans.json.length === 0, 'items cascaded away');

console.log(failures === 0 ? '\nAll assertions passed.\n' : `\n${failures} assertion(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
