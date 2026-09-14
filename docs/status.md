# Status

Last updated 2026-09-14. Update this when the state below stops being true.

## Where the project is

The mobile app makes and keeps lists: paste a Google Maps link, get a place;
name a list; put five places on it and answer two questions about each. **It now
persists** — one versioned JSON document in MMKV (decision 28). A list survives
a reload.

**Nothing is published.** That is next, and it is the last piece of the loop.

| Area                                          | State                                                          |
| --------------------------------------------- | -------------------------------------------------------------- |
| Monorepo, npm workspaces, CI                  | done                                                           |
| `apps/web` — Next.js 16                       | placeholder; to be rebuilt in Astro (decisions 26, 32)         |
| `apps/mobile` — Expo SDK 57 dev build         | home, capture, builder, storage                                |
| Splash — native + animated brand line         | done; the two are matched so the handover is invisible         |
| `packages/shared` — design tokens, brand mark | done                                                           |
| **Database**                                  | live in Supabase, hand-built. Migrations at submission (43)    |
| Google Maps link parsing                      | done, tested against real links                                |
| Geocoding                                     | done — `expo-location`, fills in whichever half the link lacks |
| List model                                    | done, pure and unit-tested                                     |
| List builder — routes, questions, map, swipe  | done (decisions 38–42)                                         |
| Editing a list's name or location             | done — tap the words (decision 44's rule, one level up)        |
| Local persistence — MMKV                      | **done** (decision 28)                                         |
| Drag to reorder                               | **built but not wired** — no home in the new page yet          |
| Publish flow                                  | **not started. This is next.**                                 |
| Auth, PostHog, share extension                | not started                                                    |

## Running it

```bash
npm install
npm run web      # http://localhost:3000
npm run ios      # iOS simulator (first build ~10 min)
npm run mobile   # dev server for an installed build
```

### Four gotchas that will waste an hour each

**Xcode.** Expo SDK 57 needs **Xcode 26.4+**; below that it fails inside
`expo-modules-jsi` with an error about `SWIFT_RETURNS_RETAINED` that looks like
an Expo bug and is not. This machine has two Xcodes installed side by side and
the system default is deliberately **26.2**, because Lady Tides (a live app on
SDK 54) is built with it. Real Rex selects the newer one per command:

```bash
DEVELOPER_DIR=/Applications/Xcode-26.6.app/Contents/Developer npm run ios
```

Never run `sudo xcode-select -s` to switch the global default.

**A native module that builds but is not there.** MMKV v4 is Nitro-based, so
`react-native-nitro-modules` is a second native dependency — and npm hoists it to
the root as a peer, where **autolinking never looks**. Both are declared in
`apps/mobile/package.json` for that reason; a native dependency at the root links
to nothing and fails at runtime with no build error.

Separately, when the app says a native module "could not be found" and
`Podfile.lock` clearly has it, the binary is stale: the simulator is relaunching
a build made before the module existed. Delete the app from the simulator and
`npx expo run:ios --no-build-cache`. Watch for an actual compile — if it jumps
straight to "Opening on iOS", it did not rebuild.

**npm audit.** Reports 13 moderate vulnerabilities. They are accepted and
documented in decision 12. **Never run `npm audit fix --force`** — it "fixes"
them by downgrading Expo from 57 to 46, a 2022 release. `npm audit` is
deliberately not in CI.

**A split React version breaks something unrelated.** This bit us once and the
symptom was nowhere near the cause. The web app pinned `react@19.2.8` while
Expo pinned `19.2.3`; npm hoisted 19.2.8 to the root, nested 19.2.3 under
`apps/mobile`, and pushed `next` down into `apps/web/node_modules` — while
`eslint-config-next` stayed hoisted at the root, where it could no longer
resolve `next` at all. Linting died with "Cannot find module", which looked
like an upstream bug and was not.

Keep React on **one** version across both apps; React Native is the stricter
constraint, so the web app follows Expo's pin. After changing a version like
this, delete `node_modules` and `package-lock.json` and reinstall — npm will
not re-hoist otherwise.

## What is decided

Read [`decisions.md`](decisions.md) before proposing an architectural change —
**forty-four** decisions are recorded there with their rejected alternatives.
Superseded entries are compressed rather than deleted; the convention is at the
top of that file.

**Decisions 28–33 (2026-09-10) changed the data model, and 43 (2026-09-14)
settled how publishing writes. If you remember it differently, they win.**

- The device is the source of truth until publish, so Supabase holds only
  published lists — `list` and `list_item`, no server-side `saved_spots`, no
  `profiles` (28).
- List items are **copies**, not references, so a published list is a snapshot
  (30).
- An auth user is created at publish, not at first write, and Apple sign-in is
  offered against publishing anonymously (29).
- There is no `publish_list()` (31, reversed by 33). **Publishing writes the item
  set at `version` N+1, then moves `list.live_version` in a single-row update**
  (43). Two requests, neither of which can tear a live page.
- Public pages are rendered on demand behind a cache rather than written at
  publish (32).

Cost control and monetisation detail live in
[`monetisation.md`](monetisation.md).

[`design.md`](design.md) has the visual system. The values live in
`packages/shared/src/tokens.ts` and are commented inline.

Highlights that catch people out:

- **RLS is not on by default** for tables created in migrations. Every
  `create table` needs `enable row level security` in the same migration.
- **The five-spot cap is structural**, enforced by a Postgres constraint, not
  application code. It is free and absolute, never a paywall.
- **PostHog is EU cloud** — `https://eu.i.posthog.com`, project `270016`. Most
  tutorials show the US host and the failure is silent. Exception autocapture is
  not yet enabled on the project; error tracking does nothing until it is.
- **Green is never small text on a light background.** See the contrast rule in
  `tokens.ts`.

## Next

**Publishing.** It is the last piece of the loop and everything visible is
waiting on it: the public page, the link, decision 37's stub. The ordered task
list is in [`todo.md`](todo.md); decision 43 has the write shape, and the DDL for
it has already been run against the live schema.

Three things block it, in this order:

1. **Real UUIDs.** `src/id.ts` is still a `Date.now()` + counter stand-in, and
   the schema's `client_ref` is a `uuid` — the column that makes a re-published
   list upsert rather than duplicate. One file, one edit, and it is the cheapest
   of the three.
2. **`linkIdentity()` must be verified.** Decision 29 rests on it preserving the
   user id. `scripts/auth-link-test.mjs` settles it and **has never been run.**
   If linking mints a new id, every URL already sent dies at the moment we ask
   someone to sign in — so this is a question to answer before building on the
   answer, not after.
3. **`get_list_by_slug()` does not exist.** `anon` has no policy on any table
   (decision 22), so a published list is currently readable only by its owner.
   It lands with the web app.

Then the Astro rewrite of `apps/web`, which is what a recipient actually sees.

**Two things the UI is still working around**, both now unblocked by storage:
the spot questions can write through on every keystroke, which lets the
swipe-back gesture come back; and reorder still has no home in the new list page
and competes with the swipe.

## Known loose ends

- **Nothing has been deployed.** No Vercel project, no Supabase project beyond
  the hand-built schema. **Turn the Supabase Spend Cap on when the project is
  created** — see [`monetisation.md`](monetisation.md).
- **`linkIdentity()` is unverified** and decision 29 rests on it.
  `scripts/auth-link-test.mjs` needs a running stack.
- **Spot and list ids are `tmp-<base36>`**, not UUIDs. Harmless until publish,
  then not — see Next.
- **`place_ref` / `place_ref_type` are outdated** but still live in `Spot`, in
  `isSame()`, in `maps-link.ts` and in decisions 23 and 30. The database does not
  have them.
- **`List.description` is vestigial** — a setter and tests, no column, and the
  design says there is no list description.
- **The Skip button on the second spot question** is not a distinct action: Skip
  and Done both leave. It advertises an exit on the one screen we most want
  answered. Raised, not decided.
- **There is no destructive colour in the tokens.** The slab behind a swiped row
  borrows `textPrimary`. A real role belongs there before release.
- **`SHORT_NOTE_MAX` is 80** and has never been chosen by anyone. It stays a
  client convention in `packages/shared/src/tokens.ts`; Charley ruled out making
  it a database constraint.
- The link expander logs `[expand] <via> <url>`. Whether short links resolve via
  the `Location` header or the final URL decides whether the native URLSession
  module in decision 17 needs to exist at all — **still unanswered**.
- The brand mark is legible to about 56px. It needs a **simplified small-size
  variant** for favicons, and a **stroke-based redraw** before it can be animated.
- The public list page has **no route back to the product**. Anything
  screenshotted and forwarded is a dead end.
- Type scale has not been checked on a real device in daylight.
- The schema has only been proven against a stand-in `auth` schema.
  `supabase/tests/schema_test.sql` is empty; `supabase/migrations/` is empty on
  purpose until submission (43).
- `@types/node` is `^20.19.43` in `packages/shared` while `engines` requires Node 22. Bump to `^22` next time someone runs an install — types only.
- The full `npm run typecheck --workspaces` needs network on first run, because
  the web app downloads `@next/swc`.
