# Decision record

Every architectural decision, why it was made, and what was rejected. Append
new entries at the bottom; do not rewrite history. If a decision is reversed,
add a new entry that supersedes the old one rather than editing it.

## Index

| #   | Decision                                            | Status                  |
| --- | --------------------------------------------------- | ----------------------- |
| 1   | Monorepo, not two repositories                      |                         |
| 2   | npm workspaces, not pnpm                            |                         |
| 3   | No task runner                                      |                         |
| 4   | Places come from pasted Google Maps links           | partly superseded by 17 |
| 5   | Shared by link; no friend graph in the MVP          |                         |
| 6   | Public pages are a separate Next.js app             |                         |
| 7   | Five spots per list, enforced by the database       |                         |
| 8   | Apple sign-in only at launch                        | partly superseded by 16 |
| 9   | PostHog for analytics, errors and logs — EU         |                         |
| 10  | Supabase migrations are the only source of truth    |                         |
| 11  | CI fails if any table lacks row-level security      | extended by 22          |
| 12  | Two npm audit advisories accepted, not patched      |                         |
| 13  | Development builds, not Expo Go                     |                         |
| 14  | Visual direction: precise and modern                |                         |
| 15  | List position is a slot, not a ranking              | open item closed by 20  |
| 16  | Anonymous sign-in at launch, Apple follows          |                         |
| 17  | Short links expanded on device, never server        |                         |
| 18  | Coordinates come from MapKit, not Google            |                         |
| 19  | No shared `places` table                            |                         |
| 20  | Note and description live on `saved_spots`          |                         |
| 21  | Capture is a burst; editing is a separate pass      |                         |
| 22  | `anon` has no table access; one public function     |                         |
| 23  | The stored shape is source-neutral                  |                         |
| 24  | Supabase session stored in AsyncStorage             | closes open item in 8   |
| 25  | App screens echo the list; the ring carries the cap |                         |

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

> **Partly superseded by decision 17.** Resolution is not server-side.

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

> **Partly superseded by decision 16.** Anonymous sign-in ships first.

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

---

## 14. Visual direction: precise and modern, not warm and editorial

**Decision.** Light-first with a first-class dark mode. Cool near-neutrals,
system fonts, Emerald accent, "precision list" layout: hairline-bordered rows,
a large green numeral per spot, mono metadata, and a footer lockup of the rex
plus the words "Real Rex".

**Why.** The reference points are Linear and Vercel for structure, Apple and
Airbnb for generosity. Full reasoning, contrast measurements and the usage
rules live in [`design.md`](design.md); the values live in
`packages/shared/src/tokens.ts`.

**Rejected — and worth recording so it is not relitigated.** A warm editorial
direction: serif headlines, beige paper, masthead rules, byline and standfirst.
It was internally consistent and wrong for this product. It read as a
newspaper; Real Rex is a friend handing you five places. Warm greige grounds in
particular tested as "dull" repeatedly.

**Also rejected.** Apple's system green `#34C759`, because the public web page
is the most-seen surface and there it carries no meaning, while in the app it
is indistinguishable from OS chrome. Emerald `#22C55E` is close enough to feel
native and is ours.

---

## 15. List position is a slot, not a ranking

**Decision.** `list_items.position` (1-5) determines display order only. It is
not a claim that spot 1 is better than spot 2.

**Why.** Forcing a strict ranking is real cognitive work at exactly the moment
someone is about to publish, which is where people abandon. The numerals still
appear in the design, so "five, and only five" stays visible without demanding
the author defend an order.

**Rejected.** A true ranking — more opinionated and more argued-about, which is
good for sharing, but not worth the friction before there are any users.

**Still open (deliberately deferred).** Whether the short note and the long
description belong on `saved_spots` (write once, appears everywhere) or on
`list_items` (different words per list), or both with an override. Raised, not
urgent, decided later.

---

## 16. Anonymous sign-in at launch; Apple sign-in follows

**Partly supersedes decision 8.**

**Decision.** The device silently gets a Supabase _anonymous_ user on first
launch. Apple is added later with `linkIdentity()` on the same user id.

**Why.** No signup wall at the moment of highest intent, and no migration ever:
RLS is written once against `auth.uid()` and the anonymous row simply becomes
the Apple row.

**Rejected.** Local-only storage until signup (two data models, a migration to
write later). A client-generated owner UUID (RLS could not use `auth.uid()`, so
the security boundary would rest on a value from a client we assume is
hostile).

**No cap on lists for anonymous users.** Decision 7's reasoning does not change
based on whether someone signed in.

---

## 17. Short links are expanded on the device, never on our servers

**Supersedes "resolved server-side" in decision 4.** The rest of 4 stands.

**Decision.** The app follows the `maps.app.goo.gl` redirect itself and reads
the `Location` header. The page is never loaded.

**Why.** Measured 2026-09-09: from a datacentre IP Google rate-limits after
roughly two requests; from an EU IP with no cookies the chain lands on
`consent.google.com`; and `robots.txt` disallows automated fetching of those
links. Edge Functions share egress IPs, so a server starts from the worst
position on all three. Eight sequential expansions from a residential
connection returned `302` with no throttling. Reading only the header means
nothing Google renders is ever fetched, so consent is never reached.

**Gotcha.** React Native's `fetch` on iOS ignores `redirect: 'manual'` and
would follow through to the consent page. Reading the header needs `URLSession`
with a delegate returning `nil` from `willPerformHTTPRedirection` — a small
native module. Not prototypable in JavaScript.

---

## 18. Coordinates come from MapKit, not from Google

**Decision.** `MKLocalSearch` on the parsed name and postal address is the
primary source of coordinates. Google's pin is used when a link happens to have
one.

**Why.** Nine real links shared from iOS Google Maps, four countries, both the
Share and Copy paths: **none contained a coordinate.** They carry name, full
street address and a feature id:

```
maps.google.com/?q=Bar+Isabel,+797+College+St,+Toronto,+ON+M6G+1C7
               &ftid=0x882b34f724906a25:0x7b97293d105c2f1&entry=gps
```

Only desktop-browser URLs carry `!3d`/`!4d` pins. A full street address with a
house number is close to ideal geocoder input, and `MKLocalSearch` is free,
keyless and already on the device. A side benefit: when the pin is Apple's, no
Google-derived coordinate is stored at all.

**Rejected.** Google Geocoding API (billed and keyed — every fork would need an
account). Nominatim/OSM (thin POI coverage for exactly the small bars this
product is about).

**Consequence.** `lat`/`lng` are nullable permanently. A spot without
coordinates is publishable; the map just does not render in its expanded row.

**Watch.** All nine samples came from one device on Maps 26.33.1. Keep the
coordinate shape supported.

---

## 19. No shared `places` table

**Decision.** Every row belongs to exactly one user. A place saved by a hundred
people is a hundred rows.

**Why.** A shared table was drafted and removed. Every problem it created was a
problem it also caused: who may write to it, whether one user's paste can
change another user's spot, and how to read it without making the whole dataset
enumerable to any signed-in account. Duplication costs a few hundred bytes.

**Rejected.** Canonical `places` + per-user `saved_spots` — deduplicates
resolution and allows a global refresh, but we had already decided refresh
would be deliberate rather than automatic.

**Reversible in one migration.** `place_ref` is on every row, so
`insert into places select distinct on (place_ref) …` backfills a canonical
table if usage ever justifies one. "Who else saved this" is a `group by` on the
same column — the derived graph decision 5 anticipated.

---

## 20. The note and the description live on `saved_spots`

**Closes the item decision 15 deferred.**

**Decision.** Both note fields are columns on `saved_spots`. `list_items`
carries only `list_id`, `saved_spot_id`, `user_id` and `position`.

**Why.** Write once, appears on every list the spot is on. One place to look
when the words are wrong.

**Rejected.** On `list_items` — nicer (different words per list) but means
retyping a note every time you reuse a spot. Both with an override — flexible,
two places to look, no evidence anyone wants it. Adding the override later is
one nullable column.

---

## 21. Capture is a burst; editing is a separate pass

**Decision.** A spot is inserted as soon as its link parses, with `title`
seeded from Google's name and the notes empty. Coordinates patch the row when
they resolve. No modal, no confirmation step, nothing steals focus.

**Why.** The real behaviour is copying five links while thinking about a city,
then sitting down later to write about them. Asking for a note at paste time
interrupts the burst five times.

**What follows, and is not optional.** Two writes per spot (insert on parse,
patch on geocode) — one write means the row cannot appear until the network
does. `title not null`, seeded from the parsed name, always editable (one
fixture place is genuinely called "4850"). "Needs a note" is derived from
`short_note is null`, not a column. Duplicate pastes are expected and handled
as "already in your library" via `unique (user_id, place_ref)`; all nine real
links carry a CID, so it works on the real path.

**v0 is paste. The share extension is v1.** Sharing from inside Maps removes an
app switch and a system clipboard banner per spot, which matters a lot in a
five-spot burst — but it is native surface area (config plugin, App Group) and
does not block a first build.

**Offline capture is refused.** A spot cannot exist without a parsed link, so
the app requires connectivity to add one and says so. No pending rows, no
retry queue, no nullable title. Rejected: storing the short URL and resolving
later — friendlier for someone planning a trip on a plane, but it puts a row
in the database that is not yet a spot, and every screen then has to render a
state that only exists because of a network condition.

**Two failure messages, not one.** They have different fixes: _"You need to be
online to add a spot"_ when there is no connection, and _"That link didn't
work — try copying it again from Maps"_ when the expansion or the parse fails.
A single generic error tells the user nothing about what to do next.

---

## 22. `anon` has no table access; one function is the entire public surface

**Decision.** RLS on every table, all privileges revoked from `anon`,
authenticated policies scoped to `auth.uid() = user_id`. The public page reads
through one `security definer` function, `get_list_by_slug(slug text)`, with
`search_path = ''`.

**Why.** "Unlisted by URL" (decision 5) is only true if the URL is the only way
in. The natural-looking policy — `select using (published_at is not null)` —
breaks it: the publishable key ships in the app bundle and the web page's
JavaScript, so anyone can read it from a network tab and then enumerate every
published list from every user in one request. A function taking an exact slug
has no query shape that returns two rows.

**Rejected.** The web app reading with the service role key — it is
server-rendered so it would work, but that key bypasses RLS entirely and one
careless line would leak everything rather than one list.

**The defaults are hostile**, so this is explicit: Supabase grants `anon`
privileges on new tables in `public`, and RLS is off by default for tables
created in SQL. Privileges are revoked as well as policied, so a future mistake
that disables RLS is not a breach on its own.

**CI asserts three things** (extending decision 11): every `public` table has
RLS; no `public` table grants anything to `anon`; the set of functions `anon`
may execute is exactly `{get_list_by_slug}`. Default privileges cover functions
too.

---

## 23. The stored shape is source-neutral

**Decision.** No column named after Google. `place_ref`, `place_ref_type`
(`text` + check, not an enum), `source_url`, `title`, `address`, `lat`, `lng`.

**Why.** The fields a spot needs are the same whatever produced them, so
generic names cost nothing now and avoid a rename later. Google stays the main
source — it is the behaviour being replaced (decision 4).

**Deliberately not built.** No provider interface or resolver registry. There
is one parser and the type it returns _is_ the abstraction. A second source is
a second function, not a framework. `text` + check because adding a value to a
Postgres enum is a migration people get wrong.

**Most valuable future importer: Google Takeout**, which exports saved places
as structured data and would solve cold start. Importing into the library does
not touch the five-spot cap, which applies to lists.

---

## 24. The Supabase session is stored in AsyncStorage

**Closes the sub-decision left open in decision 8.**

**Decision.** The session goes in AsyncStorage, as Supabase's own React Native
documentation prescribes.

**Why.** It is the documented, well-trodden path, which is decision-making rule
1: when something breaks at 11pm, the number of other people who have hit the
same error matters more than elegance. The alternative — splitting the session
across several Keychain entries, or holding the access token in memory and only
the refresh token in `expo-secure-store` — is custom code in the authentication
path, which is the most expensive place in an app to have a bug, in defence of
a threat model that does not really apply to a list of restaurant
recommendations.

**Rejected.** `expo-secure-store` alone: it is the safer store (Keychain,
hardware-backed, tied to the passcode) but it refuses values over 2048 bytes,
and a Supabase session is a JSON blob that can exceed that as JWT claims grow.
That failure arrives later, in production, and looks like a random logout.

**What is being accepted, stated plainly.** The session is a bearer token —
whoever holds it is that user. In AsyncStorage it is an unencrypted file inside
the app's sandbox. In practice iOS still protects it: the filesystem is
encrypted, and the default data protection class keeps the file unreadable
until the device's first unlock after boot. No other app can read it on a
device that is not jailbroken. The realistic exposure is an **unencrypted local
backup** (Finder/iTunes without "Encrypt local backup" ticked) or forensic
access to an unlocked device.

**Revisit** if the app ever stores something genuinely sensitive. A library of
places someone likes is not that.

---

## 25. The app screens echo the list; the ring carries the cap

**Decision.** The public list page is the fixed point of the visual system.
Every other screen borrows its row — large green numeral, name, one line
underneath — rather than inventing a layout. On the home screen the numeral is
replaced by a **segmented ring**: five arcs, filled as the list fills.

**Why.** Nine home-screen directions were drawn and discarded before it became
clear the problem was ordering, not taste: the list itself had never been
designed, so home had nothing to echo and each attempt invented a new language.
Once the list existed, home was a small edit rather than a new idea.

The ring earns its place because it makes the product's one rule visible
without writing it down. A full list closes into a complete emerald circle, so
"finished" is a shape rather than a badge, and the cap is felt on the home
screen before anyone reads a number.

**Rejected, and worth recording so they are not tried again.** Showing a list's
spots on the home screen (reveals the contents without a tap, and the row
becomes a run-on line). Three variations of one row layout. **Growing the
palette**: five hues derived from emerald in oklch, one per list, tried and
discarded — green on the numerals is the colour, which is what `design.md` said
before we went looking.

**Follows from it:**

- Exactly one bold element per screen: the page headline. Row names are medium
  weight. A column of bold names reads as a list of headings, not a list of
  places.
- **The copy-link button appears only on lists that have been sent.** A draft
  has no link, so it has no button — which means the button's presence is what
  marks a list published. No badge, no `DRAFT` label doing the same job twice.
- The numeral in `design.md` stays bare on the list page. Ringing it there was
  tried and reverted; the ring belongs to home only.

**Open.** The builder exists in two shapes — editing the list itself with the
empty slots drawn in, or picking from the library against a progress ring — and
they disagree about when `position` is assigned: at insert, or on save. That is
a schema question, so decide it before the migration.

**The sixth tap.** Adding a spot to a full list is not an error and not a
disabled row. It asks which of the five the new one replaces, with the ring
closed behind it and an always-present way out. Decision 7 says the cap is the
product; this is where a user meets it.
