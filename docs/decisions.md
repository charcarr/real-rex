# Decision record

Every architectural decision, why it was made, and what was rejected. Append
new entries at the bottom; do not rewrite history. If a decision is reversed,
add a new entry that supersedes the old one rather than editing it.

---

## 1. Monorepo, not two repositories

**Decision.** One repository containing `apps/mobile`, `apps/web` and
`packages/shared`.

**Why.** `supabase gen types` generates a single `database.types.ts` from the
schema, and both apps must use an identical copy of it. It regenerates on every
migration. Hand-copying that file between repositories, or publishing it as a
private package, is more painful than any monorepo tooling.

**Rejected.** Separate repositories — cheaper tooling, but guarantees type
drift between the app and the web page reading the same tables.

**Cost accepted.** Metro must be told about the workspace (`metro.config.js`,
~10 lines). That is the only tax the layout charges.

---

## 2. npm workspaces, not pnpm

**Decision.** npm workspaces. No `.npmrc` hacks.

**Why.** Metro cannot follow pnpm's symlinked store, so Expo's own guidance is
to set `node-linker=hoisted` — which makes pnpm produce npm's layout anyway.
At that point you have npm's node_modules with fewer people having hit your
error messages. Every Expo and EAS document assumes npm.

**Rejected.** pnpm + `node-linker=hoisted` (faster installs, less disk, rougher
edges with `expo-modules-autolinking`); Bun (fastest, least proven with EAS).

**Known hazard.** Hoisting means an app can import a package it did not declare
— works locally, fails on EAS. If you import it, declare it in that app's own
`package.json`.

**This bit us immediately, and the fix is worth remembering.** The web app
pinned `react@19.2.8` while Expo pinned `react@19.2.3`. npm hoisted 19.2.8 to
the root, nested 19.2.3 under `apps/mobile`, and — because `next`'s peer React
had to match the web app's copy — pushed `next` down into
`apps/web/node_modules` as well. But `eslint-config-next` stayed hoisted at the
root, where its `require('next/dist/compiled/babel/eslint-parser')` could no
longer resolve `next` at all. Linting the web app died with a confusing
"Cannot find module" that looked like an upstream bug and was not.

The lesson: **in a workspace, a shared peer dependency pinned to two different
versions will split the tree, and the breakage surfaces somewhere unrelated.**
Keep React on one version across both apps. React Native is the stricter
constraint (Next accepts `^19.0.0`), so the web app follows Expo's pin, not the
other way round. After changing a version like this, delete `node_modules` and
`package-lock.json` and reinstall — npm will not re-hoist otherwise.

---

## 3. No task runner

**Decision.** Plain npm workspace scripts. No Turborepo or Nx.

**Why.** Two apps and one shared package do not need task orchestration.
`npm run typecheck --workspaces` covers it. One fewer config file and one fewer
tool version to track.

**Rejected.** Turborepo — real value (cached CI tasks, one command for both dev
servers) but not yet worth the moving part. Revisit when CI gets slow.

---

## 4. Places come from pasted Google Maps links

**Decision.** A spot is added by pasting a Google Maps URL, resolved
server-side into a name, coordinates and the original link.

**Why.** It is exactly the behaviour being replaced, so it needs no user
education. Zero API cost, which matters for an open-source project — every fork
would otherwise need its own billed key. The mobile share sheet can hand off
into the app directly.

**Rejected.** Google Places Autocomplete — best search UX, but billed per
keystroke-session, its terms restrict caching place data, and it effectively
requires displaying a Google map. Mapbox/Overture/OSM — permissive and cheap,
but POI coverage for small cafes and bars is thin, which is the entire use case.

**Revisit at v1** behind a `PlaceProvider` interface so adding search later is
contained.

---

## 5. Lists are shared by link; no friend graph in the MVP

**Decision.** A published list is unlisted-by-URL. Viewers need no account.

**Why.** Distribution is already the group chat. Removing the friend graph
removes requests, accepts, feeds, moderation and the day-one empty state. It
also matches the product intent: lists are for your network, not for public
parading.

**Rejected.** Mutual friend graph (large surface, only valuable at density);
asymmetric follow (pushes toward public parading).

**Later.** Saving someone else's list to your own library gives a retention
hook and a graph that can be derived rather than designed.

---

## 6. Public pages are a separate Next.js app

**Decision.** `apps/web` on Vercel renders the public list pages.

**Why.** Links get opened from WhatsApp, so server-rendered OG images and fast
first paint matter more than code sharing. It also hosts marketing.

**Rejected.** Expo Router web export (one codebase, but weak link previews and
slow cold loads); SSR from a Supabase Edge Function (fewest vendors, but
hand-rolled templating and OG image generation).

---

## 7. Five spots per list, enforced by the database

**Decision.** A hard cap of five, enforced structurally in Postgres.

**Why.** The cap is the product. Enforced in application code it is a
suggestion; enforced in the schema it is true for every client, forever,
including out-of-date app versions and anyone holding the publishable key.

**Rejected.** Soft cap with a nudge — drifts into being another starred-places
list within a month. Per-list-type caps — an arbitrary number defended twice.

**Explicitly rejected: charging to exceed five.** It sells the one thing that
makes the product good, degrades the list for everyone who receives it, and
puts the paywall in front of the most enthusiastic sharers — the people who
drive growth. The cap is free and absolute. Monetisation, if it ever comes,
goes somewhere that does not touch the constraint.

**No cap on the number of lists.** Scarcity belongs at the recommendation
level. Long-tail themed lists are the distribution engine. If profiles get
cluttered the fix is display-level scarcity (pinned lists), which is a UI
change, not a migration — hence `pinned_at` on the lists table.

---

## 8. Apple sign-in only at launch

**Decision.** Sign in with Apple, iOS first. Google and Android later.

**Why.** Ships one auth path instead of three. Sign in with Apple is mandatory
on iOS anyway once any other social login exists.

**Rejected.** Magic links (email-to-app round trips leak users); phone OTP
(per-signup SMS cost before it is needed).

**Open.** Where the Supabase session is stored on device. `expo-secure-store`
uses the Keychain but caps values at 2048 bytes, which JWT sessions can exceed;
AsyncStorage has no cap but writes plaintext to disk. To be decided when auth
is implemented — a security decision, so it gets raised explicitly.

---

## 9. PostHog for analytics, errors and logs — EU cloud

**Decision.** One vendor. EU region, project `270016`.

**Why.** Errors, logs, replay and analytics share one SDK and one user
identity, so a funnel drop leads straight to the exception behind it. EU region
for European users.

**Rejected.** Sentry alongside PostHog — better React Native crash
symbolication, but two vendors before there are users. Revisit at beta, when
crash-free rate starts to matter.

**Watch out.** The ingestion host is `https://eu.i.posthog.com`. Nearly every
tutorial shows the US host, and the failure is silent.

**Action required.** Exception autocapture is not yet enabled on the PostHog
project. Error tracking does nothing until it is.

---

## 10. Supabase migrations are the only source of truth

**Decision.** Schema changes land as files in `supabase/migrations/`. The
production dashboard is never used to change schema.

**Why.** RLS policies are the entire security boundary; they need review,
history and reproducibility. Contributors must be able to get a working
database from a clone. Without migrations, production silently drifts from
what anyone believes is true.

**Rejected.** Designing in the hosted Supabase UI as the source of truth.

**Accepted workflow.** Design visually in the _local_ Studio
(`npm run db:start`, port 54323), then `npm run db:diff -- <name>` to capture
it as a reviewable migration. Full UI speed, full git guarantees.

---

## 11. CI fails if any table lacks row-level security

**Decision.** A CI job asserts that every table in the `public` schema has RLS
enabled.

**Why.** RLS is _not_ on by default for tables created in SQL, and a new table
in `public` starts with every privilege granted to `anon`. One forgotten
`enable row level security` is a data breach, not a bug. This converts
discipline into something a machine enforces — the only kind that survives an
open-source project with contributors.

**Cost.** About fifteen lines of SQL. GitHub Actions is free with unlimited
minutes on public repositories.

---

## 12. Two npm audit advisories are accepted, not patched

**Decision.** `npm audit` reports 13 moderate vulnerabilities. All 13 collapse
to two advisories inside Expo's dependency tree, and we accept both rather than
patching or overriding.

**Never run `npm audit fix --force` in this repository.** npm cannot find a
forward fix, so it proposes downgrading `expo` from 57 to **46.0.21** — a 2022
release. That would destroy the project. The other eleven rows are `@expo/*`
packages listed only because they transitively contain the two below.

### `decode-uri-component` ≤ 0.4.2 — GHSA-vcc3-ghjq-m6fr

CPU exhaustion from malformed percent-encoded input. Reached through
`expo-router` → `query-string` when parsing deep-link URLs. CVSS 6.6, and the
advisory is explicit that there is no risk of memory corruption, data exposure
or code execution. Worst case: a hostile deep link makes the app hang.

Patched in 0.5.0, which we deliberately do **not** force. Pinning it would push
a `0.x` major bump into the library that parses our routes — trading a possible
hang on a hostile link for possibly broken routing. Bad trade.

If we ever change our minds, the entire fix is:

```json
"overrides": { "decode-uri-component": "^0.5.0" }
```

...followed by testing deep links.

### `uuid@7.0.3` — GHSA-w5hq-g745-h8pq

Missing buffer bounds check in v3/v5/v6 **when a `buf` argument is passed**.
Expo calls v4. Not reachable. Fixing it would mean jumping uuid 7 → 14 across
an ESM rewrite, which would break Expo's tooling.

### Consequences

- Both are availability-only, there are no users yet, and Expo will pull
  patched versions in a routine SDK bump. **Re-check at every SDK upgrade.**
- `npm audit` is deliberately **not** part of CI. It would fail on all 13 on
  every run, everyone would learn to ignore a red build, and a CI signal people
  ignore is worse than the bug it was watching for.

---

## 13. Development builds, not Expo Go

**Decision.** The mobile app runs as an Expo **development build**
(`expo-dev-client`), created with `expo run:ios`. Expo Go is not used.

**Why.** Three reasons, in increasing order of importance.

1. _Expo Go couples you to Expo's release cycle._ A simulator running Expo Go
   2.33.17 against SDK 57 simply failed to connect, and the CLI tried to swap
   the binary mid-session. A development build has no shared runtime, so this
   entire class of failure disappears.

2. _Sign in with Apple cannot be meaningfully tested in Expo Go._ The library
   technically works there, but in Expo Go the bundle identifier is
   `host.exp.Exponent`, not `com.realrex.app`. Apple scopes the user identifier
   to the App ID, so the `sub` returned in Expo Go is **a different user
   identity than production will issue**. Test accounts would not carry over,
   and the real Apple Developer configuration (App ID, Service ID, signing key,
   Supabase provider settings) could not be validated at all. Finding that out
   at submission time is the worst possible moment.

3. _The share-sheet flow is impossible in Expo Go._ Adding a spot by pasting a
   link is acceptable; adding one by hitting Share in Google Maps and picking
   Real Rex is the version that feels like magic. That needs a share extension,
   which needs a config plugin, which Expo Go cannot load. We would be
   migrating within weeks regardless.

**Rejected.** Staying on Expo Go for the prototype — faster to start, but every
authentication result would be a false signal and the migration is already on
the roadmap.

**Native directories are not committed.** `ios/` and `android/` are generated by
`expo prebuild` (Continuous Native Generation) and gitignored. `app.json` and
config plugins are the source of truth. This matters for an open-source project:
no 200-file native diffs in review, and no merge conflicts in `.pbxproj`.

**Cost accepted.** The first build takes 5–10 minutes and requires Xcode.
Afterwards builds are incremental, and are only needed when native dependencies
or native config change — JavaScript changes still hot-reload instantly.
