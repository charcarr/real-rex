# Monetisation and cost control

Decision 27 sets the posture: **nothing paid in the MVP**, premium is upside
rather than the plan. This document holds the detail so the decision log stays
a decision log. Nothing here is built yet.

Two separate subjects live here and they are easy to confuse:

- **Cost control** is about not going bankrupt if the app succeeds. It is
  defensive, it needs to work before there are any customers, and most of it
  is a checkbox rather than code.
- **Monetisation** is about revenue. It comes later, it needs evidence, and it
  is deliberately not urgent.

---

## Cost control

### 1. The Supabase Spend Cap — turn this on

The single most important item on this page, and it is a toggle.

With the Spend Cap **enabled** on the Pro plan, once a usage item exceeds its
quota, further usage of that item is **disallowed until the next billing
cycle and is not charged**. Disabled, projects keep running and the overage is
billed.

It covers the items that can actually run away here: **monthly active users**,
egress, disk size, edge function invocations, logs, realtime, and storage.
It does **not** cover explicitly opted-in services — compute, read replicas,
PITR, IPv4, custom domains — but those are fixed and chosen, not demand-driven.

The trade is honest and worth taking: exceeding a quota degrades the service
until the cycle rolls over, rather than producing a bill there is no fund for.

### 2. What the failure actually looks like

Worth being precise, because the intuitive brake does not fit the failure.

The per-user cost is **MAU** — one publisher is charged once whether they make
one list or forty. A viral event is _many publishers with one list each_. So a
**per-user list cap barely moves the bill.** It is a reasonable monetisation
lever and a poor circuit breaker.

The read path is already handled: under decision 26 published pages are
rendered at publish and served as static files, so views never touch Supabase
and cost nothing at any volume.

### 3. The limits row

A single-row `limits` table in Postgres, read by `publish_list()` (decision 31):

| Field                 | Purpose                   | Ships as                                                                                                    |
| --------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `max_lists_anonymous` | anonymous publishers only | **set** — a low number, possibly 1. The only limit on at launch, and it is anti-spam, not monetisation (29) |
| `max_lists_signed_in` | signed-in publishers      | unset                                                                                                       |
| `publishing_paused`   | global stop               | false                                                                                                       |
| `publishes_per_hour`  | crude rate limit          | unset                                                                                                       |

**Why in the database rather than the app.** Changing a client-side limit
requires an App Store submission and days of review. Changing this one is a
SQL update that takes effect on the next publish. When the thing you need is
a brake, the time to reach it is the whole feature.

The client reads the same values so the UI can explain the limit rather than
show an error, but the database is the enforcement.

**This does not contradict principle 5.** "No cap on the number of lists a
user can create" stands. `max_lists_signed_in` is unset in normal operation
and exists so that the response to unexpected success is a degraded service
rather than a dark one. It is a circuit breaker, not a pricing tier, and it
should stay documented that way so nobody later reads the column and assumes
it is a product rule.

### 4. Things to watch that are not on the Spend Cap

- **Static map and OG image generation at publish.** The one piece of the
  pipeline that is not obviously free forever if it uses a hosted tile
  provider. Generating the map with **MapKit Snapshotter on the device** and
  uploading the PNG at publish would keep it at zero — MapKit is already in
  the app for geocoding (18). Not decided.
- **Cloudflare R2** — storage is cheap and egress is free, which is why 26
  works. Watch object count, not bandwidth.
- **Apple Developer Program**, $99/year, unavoidable.

---

## Monetisation

### Posture

From 27, unchanged: **annual rather than monthly**, because usage is bursty
and a monthly plan churns between trips. Premium funds nothing at consumer
conversion rates until the user base is large — decisions 26 and 28 are what
make the free tier survivable, not revenue.

### Candidates, ranked

1. **Removing the Real Rex footer.** The natural first paid feature, and the
   only one already prepared for: the footer is a single toggle in the page
   template. Note the tension — that footer is the distribution, so selling
   its removal sells the growth channel. Price it accordingly.
2. **Private or gated pages.** Password or expiry on a published list.
3. **A claimed username.** Also the first thing that needs `profiles`.
4. **Open-rate analytics.** Who opened your list, how many times.
5. **More published lists**, if the limits row ever turns on.
6. **Photos, last.** The only candidate with real marginal cost, and the only
   one that makes the shared page worse — and the recipient is the next user.

### Payments without an account

Technically possible. StoreKit ties the subscription to the Apple ID and
`Restore Purchases` resolves it on a new device, so a purchase can work with
an anonymous app user id and no auth of ours.

It is not simpler, though. Gating a **server** action means verifying
entitlement server-side against some stable identifier, which is a shadow
identity system. Since publishing already needs an owner (29), Sign in with
Apple is cheaper — and it makes the auth identity and the payment identity the
same Apple ID, so there is nothing to reconcile.

**Implication if we ever charge:** the paid path requires signing in. The
anonymous path stays free, which is the right shape anyway.

### Before any of this is built

There must be evidence someone wants it. Until then this page is a list, not a
plan.
