# Status

Last updated 2026-09-09. Update this when the state below stops being true.

## Where the project is

The scaffolding, tooling and design system are done and committed. **There is
no database and no app functionality yet.** Both apps run and render a
placeholder.

| Area                                          | State                                                     |
| --------------------------------------------- | --------------------------------------------------------- |
| Monorepo, npm workspaces, CI                  | done                                                      |
| `apps/web` — Next.js 16                       | runs, renders a placeholder page                          |
| `apps/mobile` — Expo SDK 57 dev build         | builds and runs on the iOS simulator                      |
| `packages/shared` — design tokens, brand mark | done                                                      |
| Documentation                                 | README, CONTRIBUTING, CLAUDE.md, decisions ×15, design.md |
| **Database**                                  | **not started**                                           |
| Auth, PostHog, place resolution               | not started                                               |

## Running it

```bash
npm install
npm run web      # http://localhost:3000
npm run ios      # iOS simulator (first build ~10 min)
npm run mobile   # dev server for an installed build
```

### Two environment gotchas that will waste an hour each

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
them by downgrading Expo from 57 to 46.

## What is decided

Read [`decisions.md`](decisions.md) before proposing an architectural change —
fifteen decisions are recorded there with their rejected alternatives, so you
can see what was already considered and why it lost.

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

## Next, roughly in order

1. **Database.** Sketched but nothing written. Tables are `profiles`, `places`,
   `saved_spots`, `lists`, `list_items`. The cap is
   `position smallint check (position between 1 and 5)` plus
   `unique (list_id, position)`, so the table physically cannot hold a sixth
   row. **Open question, deliberately deferred:** whether the short note and
   long description belong on `saved_spots`, on `list_items`, or both with an
   override. Decide this with Charley before writing the migration.
2. **CI check that fails the build if any table in `public` lacks RLS.**
   Agreed, not yet written.
3. **Wire Supabase and PostHog** in both apps, with env validation. No
   hardcoded keys, publishable or otherwise — this repository is public.
4. **Apple sign-in.** Open sub-decision: where the session is stored on device.
   `expo-secure-store` uses the Keychain but caps values at 2048 bytes, which
   JWT sessions can exceed; AsyncStorage has no cap but writes plaintext. This
   is a security decision, so raise it explicitly.
5. **Place resolution** — a Supabase Edge Function that follows a pasted Google
   Maps shortlink and extracts name and coordinates server-side.
6. **The list page**, built from the design in `design.md`.

## Known loose ends

- The brand mark is legible to about 56px. It needs a **simplified small-size
  variant** for favicons, and a **stroke-based redraw** before it can be
  animated — the limbs are currently one traced shape.
- The public list page has **no route back to the product**. The wordmark is a
  brand, not a destination; anything screenshotted and forwarded is a dead end.
- Type scale has not been checked on a real device in daylight.
- Nothing has been deployed. No Vercel project, no Supabase project.
