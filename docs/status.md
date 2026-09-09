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
| Documentation                                 | README, CONTRIBUTING, CLAUDE.md, decisions ×23, design.md |
| **Database**                                  | **not started**                                           |
| Google Maps link parsing                      | done, tested against real links                           |
| Auth, PostHog, geocoding, share extension     | not started                                               |

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
twenty-three decisions are recorded there with their rejected alternatives, so you
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

## Next

The ordered task list lives in [`todo.md`](todo.md). The database is the next
thing to write; everything else is blocked on it.

Two entries in the old plan have since been overturned by evidence, so if you
remember them differently, read the decisions rather than trusting memory:

- **Place resolution is not a server-side Edge Function** (decision 17). Google
  rate-limits it, an EU IP hits a consent wall, and `robots.txt` disallows it.
  The device reads the redirect header instead.
- **Google does not give us coordinates on iOS** (decision 18). Nine real
  links, four countries, zero coordinates. `MKLocalSearch` on the parsed postal
  address is the primary source; Google's pin is the lucky case.

## Known loose ends

- The brand mark is legible to about 56px. It needs a **simplified small-size
  variant** for favicons, and a **stroke-based redraw** before it can be
  animated — the limbs are currently one traced shape.
- The public list page has **no route back to the product**. The wordmark is a
  brand, not a destination; anything screenshotted and forwarded is a dead end.
- Type scale has not been checked on a real device in daylight.
- Nothing has been deployed. No Vercel project, no Supabase project.
- `@types/node` is declared in `packages/shared` at `^20.19.43`, which is what
  npm had already hoisted. `engines` requires Node 22, so bump it to `^22`
  next time someone runs an install — types only, no runtime effect.
- The full `npm run typecheck --workspaces` needs network on first run, because
  the web app downloads `@next/swc`. `packages/shared` typechecks standalone.
