# Status

Last updated 2026-09-10. Update this when the state below stops being true.

## Where the project is

The scaffolding, tooling and design system are done and committed. The schema
is live in Supabase and the mobile app has its first screen and its first real
feature: paste a Google Maps link, get a place. **There is still no list model**
— `hasLists` is hardcoded `false` — and the web app is still a placeholder.

| Area                                          | State                                                          |
| --------------------------------------------- | -------------------------------------------------------------- |
| Monorepo, npm workspaces, CI                  | done                                                           |
| `apps/web` — Next.js 16                       | placeholder; to be rebuilt in Astro (decision 26)              |
| `apps/mobile` — Expo SDK 57 dev build         | home screen, add-spots sheet, geocoding, splash                |
| Splash — native + animated brand line         | done; the two are matched so the handover is invisible         |
| `packages/shared` — design tokens, brand mark | done                                                           |
| Documentation                                 | README, CONTRIBUTING, CLAUDE.md, decisions ×27, design.md      |
| **Database**                                  | live in Supabase, built by hand; not yet in migrations         |
| Google Maps link parsing                      | done, tested against real links                                |
| Geocoding                                     | done — `expo-location`, fills in whichever half the link lacks |
| List model, builder, publish flow             | **not started — this is next**                                 |
| Local persistence (MMKV)                      | not started; the library is `useState` and empties on reload   |
| Auth, PostHog, share extension                | not started                                                    |

## Running it

```bash
npm install
npm run web      # http://localhost:3000
npm run ios      # iOS simulator (first build ~10 min)
npm run mobile   # dev server for an installed build
```

### Three gotchas that will waste an hour each

**Xcode.** Expo SDK 57 needs **Xcode 26.4+**; below that it fails inside
`expo-modules-jsi` with an error about `SWIFT_RETURNS_RETAINED` that looks like
an Expo bug and is not. This machine has two Xcodes installed side by side and
the system default is deliberately **26.2**, because Lady Tides (a live app on
SDK 54) is built with it. Real Rex selects the newer one per command:

```bash
DEVELOPER_DIR=/Applications/Xcode-26.6.app/Contents/Developer npm run ios
```

Never run `sudo xcode-select -s` to switch the global default.

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
thirty-three decisions are recorded there with their rejected alternatives, so you
can see what was already considered and why it lost.

**Decisions 28-33 (2026-09-10) changed the data model. If you remember it
differently, they win.** The device is the source of truth until publish, so
Supabase holds only published lists — two tables, `lists` and `list_items`, no
server-side `saved_spots` and no `profiles`. List items are **copies** of
library spots, not references, so a published list is a snapshot. An auth user
is created at publish, not at first write, and signing in with Apple is offered
as a choice against publishing anonymously. There is no `publish_list()` — decision 31 was
reversed by 33 and publishing will be written client-side. Public pages are rendered on demand behind a cache rather than written at
publish (32). Cost control and monetisation detail moved to
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

The ordered task list lives in [`todo.md`](todo.md).

**The list builder is next.** The home screen renders `hasLists={false}` because
there is no list model yet; building it unblocks the empty-state transition,
the publish flow (decision 33) and the public page.

Two entries in the old plan have since been overturned by evidence, so if you
remember them differently, read the decisions rather than trusting memory:

- **Place resolution is not a server-side Edge Function** (decision 17). Google
  rate-limits it, an EU IP hits a consent wall, and `robots.txt` disallows it.
  The device reads the redirect header instead.
- **Google does not give us coordinates on iOS** (decision 18). Nine real
  links, four countries, zero coordinates. `MKLocalSearch` on the parsed postal
  address is the primary source; Google's pin is the lucky case.

## Known loose ends

- `npx tsc --noEmit` in `apps/mobile` has **two pre-existing errors**:
  `RealRexMark.tsx` destructures the viewBox without a null check, and
  `theme.ts` infers the light palette's literal types and then rejects the dark
  one. Neither breaks the build; both should be fixed before typecheck goes in
  CI as a gate.
- Spot ids are `tmp-<base36>` from a module counter. They need to be real
  UUIDs before anything persists them.
- The link expander logs `[expand] <via> <url>`. Whether short links resolve
  via the `Location` header or the final URL decides whether the native
  URLSession module in decision 17 needs to exist at all — **still unanswered**.

- The brand mark is legible to about 56px. It needs a **simplified small-size
  variant** for favicons, and a **stroke-based redraw** before it can be
  animated — the limbs are currently one traced shape.
- The public list page has **no route back to the product**. The wordmark is a
  brand, not a destination; anything screenshotted and forwarded is a dead end.
- Type scale has not been checked on a real device in daylight.
- Nothing has been deployed. No Vercel project, no Supabase project. **Turn
  the Supabase Spend Cap on when the project is created** — see
  [`monetisation.md`](monetisation.md).
- `linkIdentity()` preserving the user id is unverified and decision 29 rests
  on it. `scripts/auth-link-test.mjs` settles it; it needs a running stack.
- The schema has only been proven against a stand-in `auth` schema, not a real
  Supabase. Run `supabase/tests/schema_test.sql` against the local stack before
  generating types.
- `@types/node` is declared in `packages/shared` at `^20.19.43`, which is what
  npm had already hoisted. `engines` requires Node 22, so bump it to `^22`
  next time someone runs an install — types only, no runtime effect.
- The full `npm run typecheck --workspaces` needs network on first run, because
  the web app downloads `@next/swc`. `packages/shared` typechecks standalone.
