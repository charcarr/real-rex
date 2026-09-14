#!/usr/bin/env node
//
// Does converting an anonymous user into a permanent one keep the same user id?
//
// Decision 29 rests on the answer. Supabase's documentation describes
// linkIdentity() but never says what happens to the id, and the difference
// matters: the device holds the list contents, but it does not hold the SLUG.
// If linking mints a new user, the URL you already sent to eleven people is
// dead, and "delete my account" leaves published pages behind that the user can
// no longer reach.
//
// This script answers it by doing it, against a real GoTrue. No dependencies --
// it speaks the auth REST API directly, so what you see is what the app will do.
//
// Run against the local stack:
//
//     npm run db:start
//     eval "$(supabase status -o env | sed 's/^/export /')"
//     node scripts/auth-link-test.mjs
//
// or against a project:
//
//     SUPABASE_URL=https://xxx.supabase.co SUPABASE_PUBLISHABLE_KEY=... \
//       node scripts/auth-link-test.mjs
//
// Anonymous sign-ins must be enabled on the target (Auth settings, or
// `[auth] enable_anonymous_sign_ins = true` in supabase/config.toml).
//
// What this does NOT cover: Apple specifically. Linking an OAuth identity needs
// a configured provider and a browser redirect, so the Apple run happens once
// the Apple Developer config in docs/todo.md section 8 exists. The question
// here -- whether GoTrue preserves the user row when an identity is added -- is
// provider-independent, and email is the path that can be automated.

const URL_BASE = process.env.SUPABASE_URL ?? process.env.API_URL ?? 'http://127.0.0.1:54321';
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.ANON_KEY;

if (!KEY) {
  console.error('Set SUPABASE_PUBLISHABLE_KEY (or ANON_KEY). See the header of this file.');
  process.exit(2);
}

let failures = 0;
const ok = (cond, label) => {
  console.log(`${cond ? 'PASS ' : 'FAIL '} ${label}`);
  if (!cond) failures++;
};

const sub = (jwt) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).sub;

async function api(path, { method = 'POST', token, body } = {}) {
  const res = await fetch(`${URL_BASE}${path}`, {
    method,
    headers: {
      apikey: KEY,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

const uuid = () => crypto.randomUUID();

console.log(`\nTarget: ${URL_BASE}\n`);

// ---------------------------------------------------------------------------
// 1. An anonymous user publishes a list.
// ---------------------------------------------------------------------------

const anon = await api('/auth/v1/signup', { body: {} });
if (anon.status !== 200) {
  console.error('Anonymous sign-in failed. Is it enabled on this project?');
  console.error(anon.status, JSON.stringify(anon.json, null, 2));
  process.exit(1);
}
const tokenBefore = anon.json.access_token;
const idBefore = sub(tokenBefore);
ok(!!idBefore, `anonymous sign-in created user ${idBefore}`);
ok(anon.json.user?.is_anonymous === true, 'the session is flagged is_anonymous');

const listId = uuid();
const published = await api('/rest/v1/rpc/publish_list', {
  token: tokenBefore,
  body: {
    p_list_id: listId,
    p_title: 'Test list',
    p_items: [{ title: 'A spot' }, { title: 'Another' }],
  },
});
ok(published.status === 200, `publish_list returned ${published.status}`);
const slugBefore = published.json?.[0]?.slug ?? published.json?.slug;
ok(!!slugBefore, `published anonymously, slug ${slugBefore}`);

// ---------------------------------------------------------------------------
// 2. Convert that anonymous user into a permanent one.
// ---------------------------------------------------------------------------

const email = `link-test-${Date.now()}@example.com`;
const converted = await api('/auth/v1/user', {
  method: 'PUT',
  token: tokenBefore,
  body: { email, password: 'correct-horse-battery-staple' },
});
ok(converted.status === 200, `adding an email identity returned ${converted.status}`);

const idAfter = converted.json?.id;
ok(idAfter === idBefore,
  idAfter === idBefore
    ? 'THE USER ID IS PRESERVED -- decision 29 holds, slugs survive'
    : `THE USER ID CHANGED (${idBefore} -> ${idAfter}) -- decision 29 needs revisiting`);

// ---------------------------------------------------------------------------
// 3. The published list still belongs to them, under the same URL.
// ---------------------------------------------------------------------------

const refreshed = await api('/auth/v1/token?grant_type=password', {
  body: { email, password: 'correct-horse-battery-staple' },
});
const tokenAfter = refreshed.json?.access_token ?? tokenBefore;

const mine = await api(`/rest/v1/lists?select=id,slug,published_at`, { method: 'GET', token: tokenAfter });
const found = Array.isArray(mine.json) && mine.json.find((l) => l.id === listId);
ok(!!found, 'the list published while anonymous is still theirs after signing in');
ok(found?.slug === slugBefore, `the slug is unchanged (${found?.slug})`);

const publicView = await api('/rest/v1/rpc/get_list_by_slug', { body: { p_slug: slugBefore } });
ok(publicView.status === 200 && publicView.json,
   'the public page URL still resolves, with no session at all');

// ---------------------------------------------------------------------------
// 4. The reinstall case: a second anonymous user tries to take the same
//    identity. This is the one that actually needs handling in the app.
// ---------------------------------------------------------------------------

const anon2 = await api('/auth/v1/signup', { body: {} });
const token2 = anon2.json.access_token;
const clash = await api('/auth/v1/user', {
  method: 'PUT',
  token: token2,
  body: { email, password: 'correct-horse-battery-staple' },
});
console.log(`\nReinstall case -- second anonymous user claims the same identity:`);
console.log(`  HTTP ${clash.status}  ${JSON.stringify(clash.json)}`);
console.log(`  Whatever this returns is what the app has to handle: sign in as the`);
console.log(`  existing user and push the device's library up, abandoning this one.\n`);

console.log(failures === 0 ? 'All assertions passed.\n' : `${failures} assertion(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
