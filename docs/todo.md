# MVP task list

Ordered by dependency. Everything here is required to put a build in front of
someone who is not Charley; anything that can wait is in "Not in the MVP" at
the bottom.

The rule from `CONTRIBUTING.md` applies throughout: one concern per PR, and if
the description needs the word "and" twice, split it.

## 1. Database

Nothing else can start until this lands. Decisions 19-23 settle the shape;
decision 22 settles the access model.

- [ ] Migration: helpers — `set_updated_at()`, and a slug generator producing
      12 characters from an unambiguous alphabet (~60 bits).
- [ ] Migration: `profiles`. Public-safe fields only. **Email stays in
      `auth.users`** — a profiles table with a public-read policy is one bad
      policy away from leaking addresses.
- [ ] Migration: `saved_spots`. `title not null`, `short_note`, `long_note`,
      `address`, `lat`/`lng` nullable, `place_ref`, `place_ref_type`
      (`text` + check, not an enum), `source_url`.
      `unique (user_id, place_ref)` for the duplicate-paste case.
- [ ] Migration: `lists`. `slug` unique, `published_at` nullable. No cap on
      rows per user (decision 7). No `pinned_at` — there is no profile screen
      to pin anything on yet.
- [ ] Migration: `list_items`. `position smallint check (position between 1 and
5)` plus `unique (list_id, position)` — two constraints, no trigger, and
      a sixth row becomes physically impossible.
- [ ] Cross-user ownership made unrepresentable: `unique (id, user_id)` on
      `lists` and `saved_spots`, then composite foreign keys from `list_items`
      into both. Postgres refuses a mismatched pair even if a policy is wrong.
- [ ] Every table: `enable row level security`, `revoke all … from anon`,
      policies scoped to `auth.uid() = user_id`.
- [ ] `get_list_by_slug(slug text)` — `security definer`, `set search_path =
''`, returns a list only when published and the slug matches exactly.
      Granted to `anon`; nothing else is.
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

## 4. Identity

- [ ] Anonymous sign-in on first launch (decision 16).
- [ ] Session persisted in AsyncStorage, per Supabase's RN docs (decision 24).
- [ ] A short onboarding that explains, honestly, that spots live on this
      device until an account exists.

## 5. Capture

The riskiest part of the product, and the reason it works at all.

- [ ] Native module: follow one redirect with `URLSession` and return the
      `Location` header **without following it**. React Native's `fetch`
      ignores `redirect: 'manual'` on iOS and would land on Google's consent
      page (decision 17).
- [ ] Wire `parseMapsLink` from `@real-rex/shared` to that module.
- [ ] `MKLocalSearch` geocoding on `name + address`, patching `lat`/`lng` onto
      the existing row when it resolves (decision 18).
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

- [ ] Library screen. Spots with no note are visibly incomplete — derived from
      `short_note is null`, not a column.
- [ ] The editing pass: title, short note, long note.
- [ ] List builder — toggle five spots on, reorder. Position is a slot, not a
      ranking (decision 15).
- [ ] Publish: set `published_at`, produce the URL, hand it to the share sheet.

## 7. The public page

- [ ] `apps/web` route reading through `get_list_by_slug`. No table access.
- [ ] Build it from `design.md`. Map renders only in the expanded row, and only
      when coordinates exist.
- [ ] OG image, because these links are opened from WhatsApp (decision 6).
- [ ] Give the page a route back to the product. Currently anything
      screenshotted and forwarded is a dead end.

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
- [ ] Assert a signed-in user cannot read another user's spots, and cannot put
      someone else's spot on their own list.
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
- Apple sign-in. Anonymous first; `linkIdentity()` later, no migration
  (decision 16).
- Android, Google sign-in.
- Any friend graph. Distribution is the group chat (decision 5).
- Pinned lists — no profile screen exists to pin on (decision 7).
- Pro tier: custom branding, photos, password-protected pages.
- A canonical `places` table. Reversible from `place_ref` in one migration if
  usage ever justifies it (decision 19).
- Google Takeout import. The most valuable future importer, because it solves
  cold start (decision 23).
