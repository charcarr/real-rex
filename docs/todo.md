# MVP task list

Ordered by dependency. Everything here is required to put a build in front of
someone who is not Charley; anything that can wait is in "Not in the MVP" at
the bottom.

The rule from `CONTRIBUTING.md` applies throughout: one concern per PR, and if
the description needs the word "and" twice, split it.

## 1. Database

Done by hand in the Supabase dashboard, **not yet in migrations** — that
happens before the App Store, not before the app (decision 10 is not currently
true). `supabase db pull` needs Docker; hand-copying the DDL is fine.

- [x] `list` and `list_item`, constraints, `moddatetime` triggers.
- [x] `limits` — the circuit breaker. No row means no limits, which is the
      intended resting state; nothing is set.
- [x] RLS on all three, `anon` and `authenticated` revoked, `select` granted to
      `authenticated`, one policy per table.
- [x] Helpers: `generate_public_id()`, `slugify()`, `build_slug()`.
- [x] `list_item.version` and `list.live_version`, with
      `(list_id, version, position)` and `(list_id, version, google_maps_url)`
      widened to match (decision 43). Applied by hand, 2026-09-14.
- [ ] **The publish path — this is next** (decision 43). Write the item set at
      version N+1, then move `live_version` in a single-row update. Client-side,
      no function, no server. Blocked on real UUIDs for `client_ref` and on
      `linkIdentity()` being verified.
- [ ] `get_list_by_slug()` — the one function `anon` may execute (decision 22).
      Until it exists a published list is readable only by its owner.
- [ ] Capture the schema into `supabase/migrations/` — **at App Store
      submission, not before** (decision 43). `supabase/migrations/` is
      deliberately empty until then; the working DDL lives outside the repo.
- [ ] `npm run db:types` and commit `database.types.ts`.

## 2. CI guards

Discipline that a machine enforces is the only kind that survives contributors.

- [ ] Fail the build if any table in `public` lacks RLS (decision 11).
- [ ] Fail the build if any table in `public` grants anything to `anon`.
- [ ] Fail the build if the set of functions `anon` may execute is not exactly
      `{get_list_by_slug}` (decision 22).

## 3. Wiring

- [ ] Supabase client in both apps. Env validation that fails loudly at
      startup, a committed `.env.example`, no keys in the repo — publishable
      or otherwise.
- [ ] PostHog, EU host `https://eu.i.posthog.com`, project `270016`.
- [ ] **Enable exception autocapture on the PostHog project.** Error tracking
      does nothing until this is switched on (decision 9).

## 4. Identity and local storage

- [ ] **Local store first**: a single versioned JSON document in MMKV, behind
      **one storage module**. Client-generated UUIDs and `created_at` /
      `updated_at` on every record from version one — that is the whole
      insurance policy for a later move to SQLite (decision 28).
- [ ] One shared TypeScript type for a spot in `packages/shared`, with the
      `list_items` row derived from it, so the document and the row cannot
      drift (decision 30).
- [ ] **Run `scripts/auth-link-test.mjs`** against a real stack. It answers the
      id-preservation question by doing it, and prints what the reinstall clash
      actually returns. Decision 29 rests on the first answer; the app has to
      handle the second either way.
- [ ] The publish-time choice: sign in with Apple, or publish anonymously.
      Both offered plainly; copy states the real difference, not a pitch
      (decision 29).
- [ ] Session persisted in AsyncStorage, per Supabase's RN docs (decision 24).
- [ ] Sign in later from settings — `linkIdentity()` on the existing
      anonymous user, so nothing is stranded.
- [ ] Account deletion in the app, calling `delete_account()`.

## 5. Capture

The riskiest part of the product, and the reason it works at all. Under
decision 28 every write here is **local** — the two-writes-per-spot shape from
21 still holds, but the network is only needed to expand the link and geocode,
never to store the row.

- [ ] Short-link expansion. `src/expand-link.ts` does it in JavaScript and
      **works** — decision 17 assumed React Native's `fetch` could not and that
      a native `URLSession` module was required. Confirm from the `[expand]`
      log which path it took: `location` reads the header and renders nothing,
      which is what 17 wanted; `final-url` means a page was loaded, and only
      then is the native module worth writing.
- [ ] Wire `parseMapsLink` from `@real-rex/shared` to that module.
- [x] Geocoding, both directions, via `expo-location` — Apple's geocoder, so
      still MapKit (decision 18, amended). Runs after the row is on screen and
      patches it, which is the LOCATING state on the canvas.
- [ ] Paste flow built for a burst: insert on parse, input stays ready, no
      modal, no confirmation, nothing steals focus (decision 21).
- [ ] Duplicate paste handled as "already in your library, here it is" rather
      than as an error.
- [ ] Two distinct failure states, because they have different fixes: offline
      ("you need to be online to add a spot") and unparseable ("that link
      didn't work — try copying it again from Maps"). Capture is refused
      offline; nothing is queued (decision 21).
- [ ] Log the `entry=` parameter and the resulting shape to PostHog. No
      personal data, and it tells us which branch real users are actually on.

## 6. Library and lists

All of this is device-local until the publish step.

- [ ] Library screen. Spots with no note are visibly incomplete — derived from
      `short_note` being empty, not a stored flag. The builder's picker and its
      rows already mark them; there is still no screen that lists the library
      on its own.
- [x] The editing pass: title, short note, long note. `NoteEditor`, reached by
      tapping a row in the builder. The one line is capped at 80.
- [ ] Duplicate detection on `place_ref` in the local store — this was
      `unique (user_id, place_ref)` in Postgres before decision 28.
      `spots.ts` does it in memory; it needs to survive the store.
- [x] List builder — five slots, reorder. The list itself is the screen
      (decision 34); drag is RN core only (decision 36). Nothing on the device
      stores a position — the array's order is the order.
- [x] Per-list edits to a spot's copied fields. Overrides while composing,
      copies at publish (decision 35).
- [ ] Publish: identity choice if needed, write the rows client-side
      (decision 33), then hand the URL to the share sheet. **Stubbed** — the
      three states and the fingerprint are real, the URL is a placeholder and
      the screen says so (decision 37).

## 7. The public page

- [ ] Rebuild `apps/web` in Astro, deployed to Cloudflare (decision 26).
- [ ] **Render on demand behind a cache** (decision 32). A Worker route calls
      `get_list_by_slug` on a cache miss, renders, and returns the page with a
      long TTL. Nothing is written at publish, so there is no pipeline to
      half-fail and no files to leave behind.
- [ ] The Real Rex footer is a single toggle in the template (decision 27).
- [ ] Build it from `design.md`. Disclosure is CSS only — no JavaScript on the
      page. The map is a static image, revealed rather than loaded, and only
      present when coordinates exist.
- [ ] OG image generated at publish **on the device** and uploaded once — the
      one thing kept out of the request path (decision 32).
- [ ] Give the page a route back to the product. Currently anything
      screenshotted and forwarded is a dead end.
- [ ] Purge the cached URL on publish, edit, unpublish and delete. Every write
      function already returns the slug for exactly this.
- [ ] Static map images: hosted tile providers are the one part of the
      pipeline that is not free at volume. Generating them with MapKit
      Snapshotter on the device and uploading at publish keeps it at zero.
      See `monetisation.md`.

## 8. Ship

- [ ] Apple Developer config: App ID, bundle `com.realrex.app` (permanent after
      the first submission).
- [ ] Privacy nutrition labels covering PostHog.
- [ ] TestFlight build.
- [ ] Re-check `npm audit` at the next SDK bump (decision 12). Never
      `--force`.

## Verification, before it goes to anyone

- [ ] Assert the five-spot cap holds against a real Postgres — try to insert a
      sixth row and a duplicate position.
- [ ] Assert a signed-in user cannot read or modify another user's lists or
      items.
- [ ] Assert `publish_list()` is not executable by `anon`, and that
      `unpublish` and delete purge the rendered files.
- [ ] Assert `anon` with the publishable key cannot list published lists in
      bulk — only fetch one by exact slug.
- [ ] Add each new real Maps link shape to the parser fixtures as it appears.

## Not in the MVP

Recorded so nobody re-litigates them mid-build.

- **The share extension.** v1, not v0 — an executive call. Sharing from inside
  Maps removes an app switch and a system clipboard banner per spot, which is
  the difference between pleasant and tedious in a five-spot burst, but it is
  native surface area (config plugin, App Group) and does not block a first
  build. v0 captures by paste.
- Uploading the spot library to Supabase — "back up your saved places" is the
  honest pitch for an account, and it is additive because items are copies
  (decisions 28, 30). Not needed to ship.
- Android, Google sign-in.
- Any friend graph. Distribution is the group chat (decision 5).
- Pinned lists — no profile screen exists to pin on (decision 7).
- Pro tier: custom branding, photos, password-protected pages.
- A canonical `places` table. Reversible from `place_ref` in one migration if
  usage ever justifies it (decision 19).
- Google Takeout import. The most valuable future importer, because it solves
  cold start (decision 23).
