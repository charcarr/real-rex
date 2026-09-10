# Working in this repository

Instructions for AI assistants. Humans should read `CONTRIBUTING.md`, which
says the same things at more length.

## Non-negotiables

1. **Simplest thing that works.** Justify every added dependency, abstraction
   or layer in one sentence, out loud, before adding it. If you cannot, do not
   add it.
2. **Small PRs.** One concern each. Split scaffolding along natural seams
   (tooling / database / shared code / each app).
3. **Document as you go.** Record decisions _and rejected alternatives_ in
   `docs/decisions.md`. Comment the why, never the what.
4. **Raise security decisions explicitly.** Anything touching auth, RLS,
   secrets or public data exposure gets discussed with Charley before it is
   implemented — do not decide silently.
5. **Never hardcode keys.** Environment variables and `.env.example`, always.
   This repository is public.

## Facts that are easy to get wrong

- RLS is **not** on by default for tables created in SQL migrations. Every
  `create table` needs `enable row level security` in the same migration.
- PostHog here is **EU cloud**: `https://eu.i.posthog.com`. Most documentation
  and tutorials show the US host.
- The five-spot cap is enforced structurally in Postgres, not in application
  code, and it is never a paywall.
- There is no cap on the number of lists a user may create. The `limits` row
  is a circuit breaker for a viral event, not a pricing tier — see
  `docs/monetisation.md`.
- **The device is the source of truth until a list is published** (decision
  28). Supabase holds two tables, `lists` and `list_items`, and only published
  data. There is no server-side spot library.
- **List items are copies, not references** (decision 30). A published list is
  a snapshot; editing the library does not change pages already sent.
- **Every publish goes through `publish_list()`** (decision 31). Clients never
  insert into `lists` or `list_items`.
- Mobile is Apple sign-in only at launch. Android and Google sign-in come later.

## Product feel

The app should feel like magic to use. The public list page should be zen and
healing to look at. Treat both as requirements.
