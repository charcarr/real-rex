# Decision record

Every architectural decision, why it was made, and what was rejected. Append
new entries at the bottom; do not rewrite history. If a decision is reversed,
add a new entry that supersedes the old one rather than editing it.

Kept deliberately short. Operational gotchas live in [`status.md`](status.md),
not here — nobody reads a decision log when their build is broken.

## Index

| #   | Decision                                            | Status                      |
| --- | --------------------------------------------------- | --------------------------- |
| 1   | Monorepo, not two repositories                      |                             |
| 2   | npm workspaces, not pnpm                            |                             |
| 3   | No task runner                                      |                             |
| 4   | Places come from pasted Google Maps links           | partly superseded by 17     |
| 5   | Shared by link; no friend graph in the MVP          |                             |
| 6   | Public pages are a separate web app                 | framework superseded by 26  |
| 7   | Five spots per list, enforced by the database       |                             |
| 8   | Apple sign-in only at launch                        | partly superseded by 16     |
| 9   | PostHog for analytics, errors and logs — EU         |                             |
| 10  | Supabase migrations are the only source of truth    |                             |
| 11  | CI fails if any table lacks row-level security      | extended by 22              |
| 12  | Two npm audit advisories accepted, not patched      |                             |
| 13  | Development builds, not Expo Go                     |                             |
| 14  | Visual direction: precise and modern                |                             |
| 15  | List position is a slot, not a ranking              | open item closed by 20      |
| 16  | Anonymous sign-in, created lazily                   | trigger moved by 29         |
| 17  | Short links expanded on device, never on our server |                             |
| 18  | Coordinates come from MapKit, not Google            |                             |
| 19  | No shared `places` table                            |                             |
| 20  | Note and description live on `saved_spots`          | superseded by 30            |
| 21  | Capture is a burst; editing is a separate pass      |                             |
| 22  | `anon` has no table access; one public function     |                             |
| 23  | The stored shape is source-neutral                  |                             |
| 24  | Supabase session stored in AsyncStorage             | closes open item in 8       |
| 25  | App screens echo the list; the ring carries the cap |                             |
| 26  | Astro on Cloudflare, rendered at publish            | mechanism superseded by 32  |
| 27  | Monetisation posture                                | detail in `monetisation.md` |
| 28  | The device is the source of truth until publish     |                             |
| 29  | Identity is created at publish, and is optional     | supersedes timing in 16     |
| 30  | List items are copies, not references               | supersedes 20               |
| 31  | Publishing goes through one database function       | **reversed by 33**          |
| 32  | Pages are rendered on demand behind a cache         | supersedes mechanism in 26  |
| 33  | Publishing is written client-side, not in Postgres  | reverses 31                 |
| 34  | The list itself is the builder                      | closes open item in 25      |
| 35  | Items hold overrides while composing                | implements timing in 30     |
| 36  | Reordering uses RN core, not a gesture library      |                             |
| 37  | Publishing is stubbed, and says so on screen        | until todo 3, 4 and 7       |

---

## 1. Monorepo, not two repositories

**Decision.** One repository: `apps/mobile`, `apps/web`, `packages/shared`.

**Why.** `supabase gen types` produces one `database.types.ts` that both apps
must hold an identical copy of, and it regenerates on every migration.
Hand-copying it between repositories is worse than any monorepo tooling.

**Rejected.** Separate repositories — cheaper tooling, guaranteed type drift.

**Cost accepted.** Metro needs ~10 lines of workspace config. That is the only
tax the layout charges.

---

## 2. npm workspaces, not pnpm

**Decision.** npm workspaces, no `.npmrc` hacks.

**Why.** Metro cannot follow pnpm's symlinked store, so Expo's own guidance is
`node-linker=hoisted` — which reproduces npm's layout anyway, with fewer people
having hit your error messages. Every Expo and EAS document assumes npm.

**Rejected.** pnpm + hoisted (rougher edges with `expo-modules-autolinking`);
Bun (fastest, least proven with EAS).

**Hazard.** Hoisting lets an app import a package it never declared — works
locally, fails on EAS. And a shared peer dependency pinned to two versions
splits the tree, breaking something unrelated. Keep React on one version across
both apps; React Native is the stricter constraint, so web follows Expo's pin.
The full story is in `status.md`.

---

## 3. No task runner

**Decision.** Plain npm workspace scripts. No Turborepo or Nx.

**Why.** Two apps and one package do not need orchestration.
`npm run typecheck --workspaces` covers it.

**Rejected.** Turborepo — real value in cached CI tasks. Revisit when CI gets
slow.

---

## 4. Places come from pasted Google Maps links

> **Partly superseded by 17.** Resolution is not server-side.

**Decision.** A spot is added by pasting or sharing a Google Maps URL.

**Why.** It is exactly the behaviour being replaced, so it needs no user
education, and it costs nothing — which matters for an open-source project
where every fork would otherwise need its own billed key.

**Rejected.** Places Autocomplete — best search UX, but billed per
keystroke-session, its terms restrict caching, and it effectively requires
displaying a Google map. Mapbox/OSM — permissive and cheap, but thin POI
coverage for small cafés and bars, which is the entire use case.

---

## 5. Lists are shared by link; no friend graph in the MVP

**Decision.** A published list is unlisted-by-URL. Viewers need no account.

**Why.** Distribution is already the group chat. Removing the friend graph
removes requests, feeds, moderation and the day-one empty state, and it matches
the product intent: lists are for your network, not for public parading.

**Rejected.** A mutual friend graph (large surface, only valuable at density);
asymmetric follow (pushes toward public parading).

**Later.** Saving someone else's list gives a graph that can be derived rather
than designed.

---

## 6. Public pages are a separate web app

> **Framework and host superseded by 26.** The separation still stands.

**Decision.** `apps/web` renders the public list pages and the marketing site,
separate from the mobile app.

**Why.** Links get opened cold from WhatsApp, so link previews and first paint
matter more than sharing code with the app.

**Rejected.** Expo Router web export — one codebase, but weak link previews and
slow cold loads.

---

## 7. Five spots per list, enforced by the database

**Decision.** A hard cap of five, structural in Postgres:
`check (position between 1 and 5)` plus `unique (list_id, position)`. Two
constraints, no trigger, and a sixth row is impossible.

**Why.** The cap is the product. In application code it is a suggestion; in the
schema it is true for every client forever, including out-of-date app versions
and anyone holding the publishable key.

**Explicitly rejected: charging to exceed five.** It sells the one thing that
makes the product good, degrades the list for everyone who receives it, and
puts the paywall in front of the people who drive growth. The cap is free and
absolute.

**No cap on the number of lists.** Scarcity belongs at the recommendation
level. If profiles get cluttered the fix is pinned lists — a UI change, not a
migration.

---

## 8. Apple sign-in only at launch

> **Partly superseded by 16.** Anonymous sign-in ships first.

**Decision.** Sign in with Apple, iOS first. Google and Android later.

**Why.** One auth path instead of three, and Sign in with Apple is mandatory on
iOS once any other social login exists.

**Rejected.** Magic links (email-to-app round trips leak users); phone OTP
(per-signup SMS cost before it is needed).

---

## 9. PostHog for analytics, errors and logs — EU cloud

**Decision.** One vendor. EU region, project `270016`.

**Why.** Errors, logs, replay and analytics share one SDK and one identity, so
a funnel drop leads straight to the exception behind it.

**Rejected.** Sentry alongside PostHog — better React Native crash
symbolication, but two vendors before there are users. Revisit at beta.

**Action required.** Exception autocapture is not yet enabled on the project.
Error tracking does nothing until it is.

---

## 10. Supabase migrations are the only source of truth

**Decision.** Schema changes land as files in `supabase/migrations/`. The
production dashboard is never used to change schema.

**Why.** RLS policies are the entire security boundary; they need review,
history and reproducibility, and a contributor must get a working database from
a clone. Without migrations, production drifts from what everyone believes.

**Workflow.** Design in the _local_ Studio, then `npm run db:diff -- <name>` to
capture it as a reviewable migration.

---

## 11. CI fails if any table lacks row-level security

**Decision.** A CI job asserts every table in `public` has RLS enabled.

**Why.** RLS is _not_ on by default for tables created in SQL, and a new table
in `public` starts with every privilege granted to `anon`. One forgotten line
is a data breach, not a bug. This converts discipline into something a machine
enforces — the only kind that survives contributors. Extended by 22.

---

## 12. Two npm audit advisories are accepted, not patched

**Decision.** Accept both rather than patch or override.

`decode-uri-component` ≤0.4.2 (GHSA-vcc3-ghjq-m6fr) — CPU exhaustion from
malformed percent-encoding, reached through `expo-router`'s deep-link parsing.
Availability only. Forcing 0.5.0 pushes a `0.x` major into the library that
parses our routes: a possible hang traded for possibly broken routing.

`uuid@7.0.3` (GHSA-w5hq-g745-h8pq) — needs a `buf` argument to v3/v5/v6. Expo
calls v4. Not reachable.

**Why.** Both are availability-only, there are no users, and Expo will pull
patched versions in a routine SDK bump. Re-check at every upgrade.

**`npm audit` is deliberately not in CI** — it would fail on every run and
teach everyone to ignore a red build, which is worse than the bug it watches.
See `status.md` for the command never to run.

---

## 13. Development builds, not Expo Go

**Decision.** The mobile app runs as an Expo development build
(`expo-dev-client`, `expo run:ios`).

**Why**, in increasing order of importance. Expo Go couples you to Expo's
release cycle, and a shared runtime can simply fail to connect. **Sign in with
Apple cannot be meaningfully tested there** — the bundle id is
`host.exp.Exponent`, and Apple scopes the user identifier to the App ID, so the
`sub` returned is a different identity than production will issue; you would
find that out at submission. And the share-sheet flow needs a config plugin,
which Expo Go cannot load.

**Rejected.** Staying on Expo Go for the prototype — faster to start, but every
authentication result would be a false signal.

**Native directories are not committed.** `ios/` and `android/` are generated;
`app.json` and config plugins are the source of truth. No 200-file native diffs
in review.

---

## 14. Visual direction: precise and modern, not warm and editorial

**Decision.** Light-first with a first-class dark mode. Cool near-neutrals,
system fonts, emerald accent, hairline-bordered rows with large green numerals.
Full rules and contrast measurements in [`design.md`](design.md); values in
`packages/shared/src/tokens.ts`.

**Rejected — worth recording so it is not relitigated.** A warm editorial
direction (serif headlines, beige paper, masthead rules). Internally consistent
and wrong: it read as a newspaper, and this product is a friend handing you five
places.

**Also rejected.** Apple's system green `#34C759` — indistinguishable from OS
chrome in the app, and meaningless on the web page, which is the most-seen
surface. Emerald `#22C55E` is ours.

---

## 15. List position is a slot, not a ranking

**Decision.** `list_items.position` (1–5) determines display order only. It is
not a claim that spot 1 is better than spot 2.

**Why.** Forcing a strict ranking is real cognitive work at exactly the moment
someone is about to publish, which is where people abandon. The numerals still
appear, so "five, and only five" stays visible without demanding the author
defend an order.

**Rejected.** A true ranking — more opinionated and more argued-about, not
worth the friction before there are users.

**Positions may have gaps.** The numeral shown is the row's rank, not the
stored value, so removing a spot needs no renumber. Adding one takes the lowest
free position; reordering rewrites positions in a single transaction, which is
why the unique constraint is deferrable.

---

## 16. Anonymous sign-in, created lazily

> **Supersedes the launch timing in 8.** Apple is still the first real
> provider; it is no longer a launch blocker.

**Decision.** The device gets a Supabase _anonymous_ user on its **first
write**, not on first launch. Apple is added later with `linkIdentity()` on the
same user id.

**Why.** It removes the signup wall from the moment of highest intent — the
first paste — and there is no migration to write: RLS is authored once against
`auth.uid()`, and the anonymous row simply becomes the Apple row.

**Lazily, because identity is metered.** Supabase bills monthly active users
($0.00325 beyond 100k). Creating one at launch charges you for everyone who
opened the app and never made anything. Nothing is owned before the first
write, so nothing needs an owner.

**Rejected.** Local-only storage until signup (two data models, a migration
later). A client-generated owner UUID (RLS could not use `auth.uid()`, so the
boundary would rest on a value from a client we assume is hostile).

**No cap on lists for anonymous users.** 7's reasoning does not change based on
whether someone signed in.

---

## 17. Short links are expanded on the device, never on our servers

> **Supersedes "resolved server-side" in 4.** The rest of 4 stands.

**Decision.** The app follows the `maps.app.goo.gl` redirect itself and reads
the `Location` header. The page is never loaded.

**Why**, measured 2026-09-09. From a datacentre IP Google rate-limits after
roughly two requests; from an EU IP with no cookies the chain lands on
`consent.google.com`; and `robots.txt` disallows automated fetching of those
links. Edge Functions share egress IPs, so a server starts from the worst
position on all three. Eight sequential expansions from a residential
connection returned `302` with no throttling. Reading only the header means
nothing Google renders is fetched, so consent is never reached.

**Gotcha.** React Native's `fetch` on iOS ignores `redirect: 'manual'` and
would follow through to the consent page. Reading the header needs `URLSession`
with a delegate returning `nil` from `willPerformHTTPRedirection` — a small
native module, not prototypable in JavaScript.

---

## 18. Coordinates come from MapKit, not from Google

**Decision.** `MKLocalSearch` on the parsed name and postal address is the
primary source of coordinates. Google's pin is used when a link has one.

**Why.** Nine real links shared from iOS Google Maps, four countries, both the
Share and Copy paths: **none contained a coordinate.** They carry a name, a
full street address and a feature id. Only desktop-browser URLs carry `!3d`/
`!4d` pins.

**Measured** (`scripts/geocode-test.swift`): **9/9 resolved**, and Bar But —
the one place where we hold Google's own pin — came back **4 metres away**. One
resolved as `24-26 Baker Street` rather than the restaurant, an address-level
match. Usable, but it shows `MKLocalSearch` degrades silently from finding a
business to geocoding its street.

**So the title is always Google's, never MapKit's.** `item.name` must not
overwrite it, or a list starts calling a restaurant "24-26 Baker Street". A
sharp divergence between the two is the cheapest available signal that the pin
is a building rather than the place.

**Rejected.** Google Geocoding API (billed and keyed — every fork would need an
account); Nominatim/OSM (thin POI coverage for exactly the small bars this
product is about).

**Consequence.** `lat`/`lng` are nullable permanently. A spot without
coordinates is publishable; the map just does not render.

> **Amended 2026-09-10, once both link shapes had been seen in the app.** They
> are exactly complementary, and each is missing what the other has:
>
> |                     | name | address | coordinates |
> | ------------------- | ---- | ------- | ----------- |
> | expanded short link | yes  | —       | yes         |
> | iOS share           | yes  | yes     | —           |
>
> **A user pastes one link, and it is whichever one they happen to have.** Both
> shapes reach the app for an ordinary reason: the mobile share sheet produces
> the second, and the first arrives second-hand — forwarded into WhatsApp by
> someone who was at a laptop. Asking anyone to supply both is not a fallback,
> it is a bug.
>
> So geocoding is **required rather than corrective**, and it runs in whichever
> direction the link left empty: forward from the address when there are no
> coordinates, reverse from the coordinates when there is no address. Same
> geocoder, and on iOS that is still MapKit — reached through `expo-location`
> rather than a hand-written module, because the wrapper is first-party, does
> both directions and is less code to own.
>
> **This also closes an idea that looked appealing and is not.** Pasting the
> same place both ways would produce a complete record, so a duplicate paste
> could enrich the existing spot rather than being discarded. Nobody will ever
> do that, and building for it would mean designing a flow that asks. The
> duplicate stays what decision 21 says it is: "already in your library".
>
> Failures stay silent. A spot that cannot be located is still a spot, and the
> row keeps whatever the link gave it.

---

## 19. No shared `places` table

**Decision.** Every row belongs to exactly one user. A place saved by a hundred
people is a hundred rows.

**Why.** A shared table was drafted and removed: every problem it created was a
problem it also caused — who may write to it, whether one user's paste can
change another user's spot, and how to read it without making the whole dataset
enumerable. Duplication costs a few hundred bytes.

**Rejected.** Canonical `places` + per-user `saved_spots` — deduplicates
resolution and allows a global refresh, but we had already decided refresh
would be deliberate rather than automatic.

**Reversible in one migration.** `place_ref` is on every row, so
`insert into places select distinct on (place_ref) …` backfills a canonical
table if usage ever justifies one.

---

## 20. The note and the description live on `saved_spots`

**Closes the item 15 deferred.**

**Decision.** Both note fields are columns on `saved_spots`. `list_items`
carries only `list_id`, `saved_spot_id`, `user_id` and `position`.

**Why.** Write once, appears on every list the spot is on. One place to look
when the words are wrong.

**Rejected.** On `list_items` — different words per list is nicer, but means
retyping a note every time you reuse a spot. Both with an override — flexible,
two places to look, no evidence anyone wants it.

---

## 21. Capture is a burst; editing is a separate pass

**Decision.** A spot is inserted as soon as its link parses, with `title`
seeded from Google's name and the notes empty. Coordinates patch the row when
they resolve. No modal, no confirmation, nothing steals focus.

**Why.** The real behaviour is copying five links while thinking about a city,
then sitting down later to write about them. Asking for a note at paste time
interrupts the burst five times.

**What follows, and is not optional.** Two writes per spot — one write means
the row cannot appear until the network does. `title not null`, always
editable (one real fixture place is called "4850"). "Needs a note" is derived
from `short_note is null`, not a column. Duplicate pastes are expected and
handled as "already in your library" via `unique (user_id, place_ref)`.

**Offline capture is refused.** No pending rows, no queue, no nullable title.
Two distinct messages, because the fixes differ: _"You need to be online to add
a spot"_ and _"That link didn't work — try copying it again from Maps"_.

**v0 captures by paste. The share extension is v1** — it removes an app switch
and a clipboard banner per spot, but it is native surface area and does not
block a first build.

---

## 22. `anon` has no table access; one function is the public surface

**Decision.** RLS on every table, all privileges revoked from `anon`,
authenticated policies scoped to `auth.uid() = user_id`. The public page reads
through one `security definer` function, `get_list_by_slug(slug text)`, with
`search_path = ''`.

**Why.** "Unlisted by URL" (5) is only true if the URL is the only way in. The
natural-looking policy — `select using (published_at is not null)` — breaks it:
the publishable key ships in the app bundle and the page's JavaScript, so
anyone can read it from a network tab and enumerate every published list in one
request. A function taking an exact slug has no query shape that returns two.

**Rejected.** The web app reading with the service role key — it bypasses RLS
entirely, so one careless line leaks everything rather than one list.

**The defaults are hostile**, so this is explicit: Supabase grants `anon`
privileges on new `public` tables, and RLS is off by default in SQL. Privileges
are revoked as well as policied, so a future mistake that disables RLS is not a
breach on its own.

**CI asserts three things** (extending 11): every `public` table has RLS; no
`public` table grants anything to `anon`; the set of functions `anon` may
execute is exactly `{get_list_by_slug}` — default privileges cover functions
too.

---

## 23. The stored shape is source-neutral

**Decision.** No column named after Google. `place_ref`, `place_ref_type`
(`text` + check, not an enum), `source_url`, `title`, `address`, `lat`, `lng`.

**Why.** The fields a spot needs are the same whatever produced them, so
generic names cost nothing now and avoid a rename later. Google stays the main
source — it is the behaviour being replaced (4).

**Deliberately not built.** No provider interface or resolver registry. There
is one parser and the type it returns _is_ the abstraction; a second source is
a second function. `text` + check because adding a value to a Postgres enum is
a migration people get wrong.

**Most valuable future importer: Google Takeout**, which exports saved places
as structured data and would solve cold start.

---

## 24. The Supabase session is stored in AsyncStorage

**Closes the sub-decision left open in 8.**

**Decision.** AsyncStorage, as Supabase's own React Native documentation
prescribes.

**Why.** It is the documented, well-trodden path. The alternative — splitting
the session across Keychain entries — is custom code in the authentication
path, the most expensive place in an app to carry a bug, in defence of a threat
model that does not apply to a list of restaurants.

**Rejected.** `expo-secure-store` alone: safer (Keychain, hardware-backed) but
it refuses values over 2048 bytes, and a session can exceed that as JWT claims
grow. That failure arrives in production and looks like a random logout.

**Accepted, plainly.** The session is a bearer token in an unencrypted file
inside the app sandbox. iOS still encrypts the filesystem and keeps the file
unreadable until first unlock, and no other app can read it unjailbroken. The
realistic exposure is an unencrypted local backup, or forensic access to an
unlocked device. Revisit if the app ever stores something genuinely sensitive.

---

## 25. The app screens echo the list; the ring carries the cap

**Decision.** The public list page is the fixed point of the visual system.
Every other screen borrows its row — large green numeral, name, one line
underneath. On the home screen the numeral becomes a **segmented ring**: five
arcs, filled as the list fills.

**Why.** Nine home-screen directions were drawn and discarded before it became
clear the problem was ordering, not taste: the list had never been designed, so
home had nothing to echo. The ring makes the product's one rule visible without
writing it down — a full list closes into a complete emerald circle, so
"finished" is a shape rather than a badge.

**Follows.** Exactly one bold element per screen: the page headline. **The
copy-link button appears only on lists that have been sent**, so its presence
is what marks a list published — no badge doing the same job twice.

**Rejected.** Showing a list's spots on the home screen (reveals contents
without a tap). **Growing the palette** — five hues derived from emerald in
oklch, one per list, tried and discarded. Green on the numerals is the colour.

**The sixth tap.** Adding a spot to a full list is not an error and not a
disabled row: it asks which of the five the new one replaces. 7 says the cap is
the product; this is where a user meets it.

---

## 26. Astro on Cloudflare, rendered at publish

> **Supersedes the framework and host in 6.** The separation stands.

**Decision.** `apps/web` is Astro, deployed to Cloudflare. A list page and its
OG image are **generated when the list is published** and served as static
files. Maps on the page are static images made the same way.

**Why.** The page ships zero JavaScript by design — system fonts, and a
disclosure that is CSS only — so a React framework would render static HTML for
nothing. Taking React out of `apps/web` also ends the version-split hazard in 2. And publish-time rendering changes the economics: Cloudflare bills nothing
for static assets, so views are free at any scale, and **Supabase is not in the
read path**, so a viral list cannot take the database down with it. The failure
shape matters more than the cents.

**Rejected.** Next.js via OpenNext — the Adapter API landed in 16.2 and
Cloudflare is a partner, so hosting works fine; it is simply a framework sized
for an app we are not building. Hono (fine for one page, unpleasant by page
three). SvelteKit (a second UI paradigm beside React Native).

**Trade-off.** An edit regenerates the page, so a recipient's view is seconds
behind rather than instant.

---

## 27. Monetisation posture

**Decision.** Nothing paid in the MVP. The only thing built now is that the
Real Rex footer is a **single toggle** in the page template.

**Why.** That footer is the distribution — every forwarded list is an ad — so
removing it is the natural first paid feature, and retrofitting the toggle
later means redesigning the template.

**Candidates, ranked.** Custom branding; private or gated pages; a claimed
username; open-rate analytics. **Photos last**, because they are the only one
with real marginal cost and the only one that makes the shared page worse — and
the recipient is the next user.

**Shape.** Annual, not monthly: usage is bursty, and a monthly plan churns
between trips.

**Premium is upside, not the plan.** At consumer conversion rates it funds
nothing until the user base is large, so 26 and 16 are what make the free tier
survivable. None of this is built until there is evidence anyone wants it.

---

## 28. The device is the source of truth until publish

**Decision.** The spot library and unpublished lists live **only on the
device**. Supabase holds exactly what has been published, and nothing else.

**Why.** A Supabase _anonymous user_ is as device-bound as local storage —
no email, no password, no recovery. Delete the app and the session is gone and
the rows are orphaned in Postgres forever. Storing the library server-side was
therefore paying the full price of a server — metered identity, RLS surface, a
table to get right — for none of the benefit a server exists to provide.

So the boundary moves to where a real difference appears: **data goes to the
server when the server has a job to do**, which is serving a public page.

**What follows.** The MVP schema is two tables, `lists` and `list_items`.
There is no server-side `saved_spots` and no `profiles`. `unique (user_id,
place_ref)` — the duplicate-paste case in 21 — becomes a device-side check.

**The five-spot cap is unaffected.** It is still a Postgres constraint on
`list_items`, so nothing that reaches the public web can carry six. A draft on
a device is not published, and the cap is a rule about lists, not about
scratch space.

**Local storage is a single versioned JSON document in MMKV**, not SQLite.
A few hundred spots do not need a query planner, and MMKV writes atomically.
Two things make the later move to SQLite an afternoon rather than a
migration project, and both are nearly free now: **client-generated UUIDs and
`created_at` / `updated_at` on every record from the first version**, and
**one storage module** rather than storage calls spread across screens.

**Rejected.** Server-side library behind an anonymous user (today's model —
cost without benefit, see above). `expo-sqlite` from the start (a second
schema to maintain before anything queries it).

**Closes the open design question in `design.md`** — whether
`list_items.position` is assigned at insert or on save. Position is now a
device concern; the server only ever receives a final ordered set of five.

---

## 29. Identity is created at publish, and signing in is optional

> **Supersedes the timing in 16.** Anonymous-first stands; the trigger moves
> from the first write to the first publish.

**Decision.** No auth user exists until someone publishes. At that moment they
choose: **sign in with Apple, or publish anonymously.** Both are offered
plainly; neither is the trap door.

**Why here.** 16's real argument was that a signup wall does not belong at the
moment of highest intent — the first paste. Under 28 the paste is free and
local, so the argument is satisfied without a wall anywhere. Publishing is a
deliberate "I am putting this on the internet" act, which is where an account
question is expected rather than resented.

**Why optional.** The app should feel like a tool, not a funnel. Where we ask
for something, the user should want to give it. So the choice is real, and the
line we show is the true difference rather than a pitch:

> Sign in and you can get this list back if you lose your phone.
> Stay anonymous and this device is the only way to edit or delete it.

**`linkIdentity()` is what makes anonymous honest.** It attaches an Apple
identity to the existing anonymous user **keeping the same user id**, so lists
published anonymously follow you when you sign in later. Anonymous is a
deferral, not a dead end.

> **What is actually at stake, and how it is tested.** Not the data — the
> device holds the library and the list contents, so a transfer to a new user
> is always possible. What the device does not hold is **the slug**. If linking
> mints a new user id, the URL already sent to eleven people dies at the exact
> moment we asked the user to sign in, and `delete_account()` stops being true:
> a set of published pages would survive, owned by a session no device can
> reach.
>
> Supabase's documentation describes `linkIdentity()` without saying what
> happens to the id, so `scripts/auth-link-test.mjs` does it and reports the
> answer rather than reasoning about it.
>
> **The case that needs handling either way is the reinstall.** Publish
> anonymously, link Apple, reinstall, publish anonymously again, then try to
> link the same Apple identity — which is taken. Linking must fail there. The
> app signs in as the existing user and pushes the device's library up,
> abandoning the throwaway anonymous user; the loss is small because that user
> has published almost nothing.

**No billing saving.** An anonymous user is a real `auth.users` row and counts
towards MAU exactly like an Apple user — Supabase counts a distinct user id per
billing cycle on sign-in **or token refresh**, so an anonymous user who opens
the app is billed every month, forever. What this decision buys is friction
removal, which is worth buying on its own terms. What actually keeps the bill
down is 26 and 28.

**Unauthenticated visitors are not users.** The `anon` PostgREST role has no
id and never reaches the auth server, so page views cost nothing at any volume
— and under 26 they do not reach Supabase at all.

**Accountability, since anonymous publishing is a spam vector.** Anonymous
publishers get a low list cap (details in `monetisation.md`, which owns the
limits). An admin unpublish — `published_at = null` plus a purge of the
rendered files — exists from day one.

**Rejected.** Requiring Apple sign-in to publish: one identity model, no
`linkIdentity()`, no orphans, and published lists always recoverable — but it
puts a wall at the exact moment we most want to feel effortless, and it saves
nothing, because the MAU is charged either way.

---

## 30. List items are copies, not references

> **Supersedes 20.** The note still lives in one place while you are
> composing; it is copied when you publish.

**Decision.** `list_items` carries its own copy of the spot fields — `title`,
`short_note`, `long_note`, `address`, `lat`, `lng`, `place_ref`,
`place_ref_type`, `source_url` — seeded from the library spot and editable
afterwards. It does not reference a `saved_spots` row.

**Why.** Three reasons, in order of weight.

It is what makes 28 possible: the published list does not depend on the library
existing on the server, so the library can stay on the device and be added
later as an additive migration that changes nothing about publishing.

**A published list is a snapshot, and should be.** Most published documents do
not rewrite themselves. Fixing a typo in your library should not silently
change a page you sent to eleven people last month, and the boundary between
draft and public is something a user can feel rather than something we have to
explain.

Under 26 it also removes a fan-out: with references, editing one spot's note
would require regenerating every published page containing it. With copies, an
edit touches exactly one page.

**20's rejection reason no longer applies.** It rejected per-list notes because
they meant "retyping a note every time you reuse a spot". Copy-on-add removes
the retyping — the note is seeded from the library, then editable.

**Consistent with 19.** Duplication over normalisation, a few hundred bytes,
one level up.

**Cost accepted.** "One place to look when the words are wrong" is gone. A
library edit does not propagate. This is explainable and correct; an "update
from library" affordance is possible later and is not built now.

**One shared TypeScript type** for a spot in `packages/shared`, with the
generated `list_items` row derived from it, so the local document and the
server row cannot drift.

---

## 31. Publishing goes through one database function

**Decision.** `publish_list(...)` — `security definer`, `set search_path = ''`,
granted to `authenticated` only. It generates the slug, replaces the item set
atomically, validates, and sets `published_at`. Clients never insert into
`lists` or `list_items` directly.

**Why.** Publishing is a transaction — a list, up to five items, a slug — and
one round trip that either fully happens or does not is both simpler than
orchestrating it client-side and the only version that cannot leave a
half-published list behind. Constraints that matter are enforced in the
database (principle 4), and this is the one place every publish passes through.

It is also where a limit belongs if one is ever needed. **A cap in the client
requires an App Store submission to change; a cap in this function is a SQL
update that takes effect immediately.** `monetisation.md` owns what those
limits are and when they turn on; this decision only records that the
enforcement point exists and that it is server-side.

**Unpublishing keeps the row.** `published_at = null`, slug retained, so a
re-publish reuses the URL and links already sent keep working. Deleting a list
is a separate, real delete — and both paths must purge the rendered files.

**22 is unchanged.** `anon` still executes exactly one function,
`get_list_by_slug`; `publish_list` is `authenticated` only. The CI guard keeps
asserting the `anon` set is exactly `{get_list_by_slug}`.

**Rejected.** Client-side inserts with RLS policies doing the work — fewer
moving parts on day one, but no atomicity, the slug generated somewhere a
hostile client can influence, and nowhere to put a limit later that does not
ship in a binary.

---

## 32. Pages are rendered on demand behind a cache

> **Supersedes the mechanism in 26, not its reasoning.** Astro on Cloudflare
> stands. Views still cannot take the database down. What changes is that
> nothing is written at publish time.

**Decision.** A visitor hits `/l/:slug`. On a cache miss a Worker calls
`get_list_by_slug`, renders the page and returns it with a long TTL; publish,
edit and delete purge that URL. No files are produced at publish. Publishing is
one database call and nothing else.

**Why.** 26 proposed rendering at publish and writing static files, which needs
a write pipeline, and a write pipeline can half-fail: `publish_list()` succeeds,
the render dies, and now a row is marked published with no page behind it — a
broken URL that has already been sent. Repairing that honestly costs a
`rendered_at` column, a retry sweep, an object store, and a purge-on-delete
path for the files.

Rendering on demand deletes all of it, and the reason is not effort. **The page
exists the instant the row does, by construction.** There is no second source
of truth, so there is nothing to fall out of sync.

**Compare the failure shapes**, which is the language 26 used to choose in the
first place:

|                       | rendered at publish | rendered on demand                         |
| --------------------- | ------------------- | ------------------------------------------ |
| render or purge fails | the URL 404s        | the page is stale until the TTL            |
| Supabase is down      | pages serve         | cached pages serve; a brand-new list fails |
| a list goes viral     | free                | one database hit per PoP per TTL           |

Every failure becomes "slightly stale" rather than "broken", and 26's actual
goal survives: the cache absorbs the traffic, so the database sees a trickle
regardless of how popular a list gets.

**The cost, stated plainly.** Static asset requests on Cloudflare are free and
unlimited; a Worker route is billed per invocation — 100,000 a day free, then
$5 a month. So pre-rendering is free at any scale and this is not. At 100,000
views a day, five dollars is not the problem we will have.

**Why this is a cheap decision to get wrong.** The mobile app's only job is
calling `publish_list()`. Moving to pre-rendered files later is a web-only
change with no mobile rework, so this defers the web decision rather than
making it.

**Rejected.** Pre-rendering to R2 with `rendered_at` and a retry sweep — free
at any scale, and correct, but it buys that with a moving part whose failure
mode is a dead link. Revisit if traffic ever makes the Worker bill interesting.

**The OG image is the exception** and is still generated at publish, on the
device, and uploaded once. It is immutable per version, image rendering is the
fiddliest thing to do in a Worker, and a missing OG image degrades to "no
preview thumbnail" rather than to a broken page — so it does not belong in the
request path.

---

## 33. Publishing is written client-side, not as a Postgres function

> **Reverses 31.** `publish_list` was written, tested and then removed. This
> entry records why, and what the publish flow should be when it is built —
> which is not yet.

**Decision.** There is no `publish_list` function. The publish path will be
written in the client, against tables, RLS policies and column grants. If it
ever needs a real transaction, it moves to a server we own — not back into the
database.

**Why.** Not correctness: the function was correct, atomic and cheap
(~0.2ms per publish). It was rejected on **maintainability**, which is
principle 1 and outranks the rest. Eighty lines of plpgsql carrying the limit
checks, the upsert, the slug rebuild and the item swap is the most complex
logic in the product, and it lived somewhere you cannot set a breakpoint, step
through, or read in a pull request without going looking for it. Putting it in
a migration fixes the version control and not the obscurity.

Stated as the rule: **logic this complex does not live somewhere invisible.**

**What we verified while deciding, so nobody re-derives it**

- **PostgREST runs one transaction per request** and has no mechanism to hold
  one open across requests. This is a documented non-goal, not a gap.
- **A single SQL statement cannot do it either.** Data-modifying CTEs share one
  snapshot, but unique constraints are checked across the whole statement, so
  `delete` + `insert` on `list_item` in one CTE fails with `23505` against
  `list_item_position_unique`. Tested. Replacing the item set genuinely needs
  two statements in one transaction.
- And a client cannot send arbitrary SQL through PostgREST by design — the
  only way to send a multi-statement query is to name it, which is what a
  function is. So over this transport, "one query from the client" and "a
  stored function" are the same object. That is why the fallback is a server,
  not a cleverer query.

**The flow to build, when the publish button exists**

_First publish is safe client-side._ Three requests, and nothing is visible
until the last one:

```
POST  /list        one row
POST  /list_item   the array of up to five — one request, one transaction
PATCH /list        published_at = now()
```

_Editing a live list is the only unsafe path._ `DELETE` the items then `POST`
the new ones leaves a window where the live page has no spots, and a request
landing in it caches an empty page for the whole TTL. Two ways to close it,
decided at the time:

1. **A `version` column.** Insert the new items at version N+1, then `PATCH`
   `list.live_version` — one statement, atomic, no window. Costs a column, a
   changed unique constraint `(list_id, version, position)`, a filter on every
   public read, and a cleanup path for old versions.
2. **A server.** One connection, `begin / delete / insert / commit`. This is
   the option that motivated the decision, and the preferred one if a server
   exists for any other reason by then.

_Accept the window_ only knowingly. It is short and rare; it is not nothing.

**What the client must NOT be trusted with, and where that is enforced**

- **Ownership and the limits** go in RLS `with check` — a client can skip
  calling a helper, it cannot skip a policy:
  ```sql
  with check (
    (select auth.uid()) = user_id
    and not coalesce((select publishing_paused from public.limits), false)
  )
  ```
- **`can_publish()`** is worth adding as a small read-only function, but as
  **UX only** — so the app can grey out the button and say why, rather than
  letting someone tap and catch an error. It is not enforcement.
- **`public_id` and `slug`** should not be client-writable. `public_id` has a
  default; `slug` wants a `before insert or update` trigger building it from
  the title, so a client cannot choose its own URL. Use column-level grants
  (`grant insert (title, description, client_ref) on public.list`) so a new
  column is not writable by default.
- **The five-spot cap and the item shape** are already constraints and need
  nothing.

**What stays.** The tables, their constraints, both `select` policies, the
`limits` table, and the slug helpers. All of that is correct and none of it is
obscure. Only the write function is gone.

**Not built yet, deliberately.** Capture, the library, the builder and
reordering are all device-local, so the publish path is weeks away. Deciding
the write shape now would mean choosing between the version column and a
server before knowing whether the server exists.

---

## 34. The list itself is the builder

**Closes the open item in 25** — "editing the list with empty slots drawn in,
versus picking from the library against a progress ring."

**Decision.** The list is the screen. Five rows, always: filled ones show the
spot, empty ones are drawn as empty slots. Tapping an empty slot opens the
library; tapping a filled one opens its words. The list's title is the
screen's one bold element.

**Why.** Decision 25 makes the public page's row the fixed point, and this is
that row with holes in it — nothing new is invented and nothing has to be
learned twice. Drawing the empty slots makes the cap a shape you can see
before you meet it, which is the same job the ring does on home. And you are
looking at the thing you are making the entire time, so ordering is not a
second step you have to be sent to.

**Rejected.** _Library first, then order_ — two clear moments, but you never
see the list until the end, and it needed a screen that exists only during
creation. _One screen, two zones_ — list above, library below; honest, but at
five rows the list is a third of the screen and the library is the rest, which
reads as a library browser with a list attached.

**The schema question is gone.** 25 recorded this as blocking the migration
because the two shapes disagreed about when `position` is assigned. Decision
28 removed the disagreement: nothing on the device stores a position at all.
The array's order is the order, and positions are assigned once, at publish,
when the rows reach Postgres.

---

## 35. A list item holds overrides while composing, and copies at publish

**Implements the timing 30 stated but did not build.**

**Decision.** On the device a list item is a spot id plus the fields _this
list_ disagrees with — `title`, `short_note`, `long_note`, each null meaning
"whatever the library says". They are resolved against the library for
display, and frozen into real copies at publish, which is the row shape 30
specifies.

**Why.** 30's own preamble says the words live in one place while you are
composing and are copied when you publish. Overrides are what makes that
literally true: edit a note in your library and every draft that has not
overridden it follows along, which is what a default is. Storing copies at
add time would mean a library edit silently failing to reach a list you have
not published yet, which is the confusing half of snapshot semantics without
the reason for it.

**Follows.** The note editor names the scope on screen rather than implying
it, defaulting to the library, because writing "the garlic prawns" once and
having it appear everywhere is the common case and editing five lists by
accident is not recoverable by a user who did not know it happened.

**The three states are derived, not stored.** A published list carries a
fingerprint of the content as sent; comparing it to the current fingerprint is
what tells _published_ from _published with unpublished edits_. No dirty flag
anyone can forget to set, an edit that is undone correctly stops counting, and
— because the fingerprint is taken over resolved content — editing a note in
your library counts as an edit to every published list that inherits it, which
it genuinely is.

---

## 36. Reordering uses React Native core, not a gesture library

**Decision.** Drag-to-reorder is `PanResponder` and `Animated`. No
`react-native-gesture-handler`, no `react-native-reanimated`.

**Why.** The cap does the work. Five rows of one fixed height means "which
slot is the finger over" is a division, and the whole gesture is a responder
plus one animated value per slot — about 120 lines that we own and can read.
Those libraries earn their keep on long lists with variable row heights, and
neither is true here. Both are native dependencies, so both cost a prebuild
and a place in `apps/mobile/package.json`.

**Rejected.** `react-native-draggable-flatlist` and friends — smoother, and
almost certainly right the day a screen has a long list on it. Adding them now
would be paying for a ceiling the product constant says we will never reach.

**When to reverse this.** The moment any list in this app is longer than a
screen. Replace the component rather than growing it.

---

## 37. Publishing is stubbed, and says so on screen

**Decision.** The publish button moves a list into the published state and
hands over a placeholder URL — the repository — and the screen labels it
`PLACEHOLDER — NOTHING IS LIVE YET`.

**Why.** The builder needs its three states to be real to be worth reviewing,
and the states are the part that can be built now: there is no Supabase
client, no identity and no public page (todo 3, 4, 7). The alternative was
minting a `realrex.app` link that 404s, which is a lie told by an app whose
entire product is handing someone a link they can trust. If it is not live,
the screen says so.

**Everything around it is real.** The state machine, the fingerprint, the
share sheet. Making it true is a change to `markPublished` and one URL.

**The clipboard is deferred.** React Native core dropped `Clipboard`, so a
true one-tap copy needs `expo-clipboard` — a native dependency, and one that
caused a `PBErrorDomain` build failure last time it was linked while unused.
The share sheet has Copy in it and is where this ends up anyway (todo 6), so
it stands in until publishing is real.
