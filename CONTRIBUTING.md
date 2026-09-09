# Contributing to Real Rex

## Principles

**1. Maintainability is king.** The simplest solution that works, wins. Every
piece of added complexity must justify itself out loud — if you cannot explain
in one sentence why a dependency, abstraction or layer earns its keep, it does
not go in. Prefer boring, well-trodden tooling: when something breaks at 11pm,
the number of other people who have hit the same error matters more than
elegance.

**2. Small, readable pull requests.** One concern per PR. If the description
needs the word "and" twice, split it. Say what changed, why, and what a
reviewer should look at closely. A PR should be reviewable in one sitting.

**3. Documentation is written at the same time as the code.** Not afterwards.
Architectural decisions are recorded in `docs/decisions.md` together with the
alternatives that were rejected and why. Comment the _why_, never the _what_ —
obvious lines get no comment.

**4. Security is discussed, not assumed.** Anything touching authentication,
authorization, RLS, secrets or public data exposure gets raised explicitly in
the PR description. Default to the most restrictive option, then open up
deliberately.

## The one rule that matters most

**Row-level security is not enabled by default on tables created in
migrations.** A new table in `public` starts with every privilege granted to
`anon`, `authenticated` and `service_role`. That means a table created and
forgotten is readable _and writable_ by anyone holding the publishable key —
which is everyone, because it ships in the app bundle.

So: **every `create table` is followed by `enable row level security` in the
same migration.** CI fails the build otherwise. Do not disable that check.

Related traps:

- The `service_role` key bypasses RLS entirely. It never appears in a client
  bundle, a `NEXT_PUBLIC_*`/`EXPO_PUBLIC_*` variable, or this repository.
- A view over an RLS-protected table runs as its _creator_ unless you write
  `create view … with (security_invoker = true)`. Without it the view hands out
  exactly what the policies were hiding.
- `security definer` functions bypass RLS by design. Use them deliberately and
  keep them tiny.

## Constraints belong in the database

The five-spot cap is enforced by the schema, not by the app. Assume every
client is hostile and every client is out of date. If a rule matters, Postgres
enforces it.

## Secrets

Never commit a secret, and never hardcode a key — not even a publishable one.
Everything goes through environment variables, with a committed `.env.example`
documenting each one. This repository is public.

## Before you open a PR

```bash
npm run format
npm run lint
npm run typecheck
```

## Commits

Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
Scope where it helps — `feat(db): …`, `fix(mobile): …`.
