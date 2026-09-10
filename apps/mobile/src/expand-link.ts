/**
 * Short-link expansion — the experiment decision 17 left open.
 *
 * `maps.app.goo.gl/…` carries no data. Something has to follow the redirect
 * once, on this device, for a link this user is holding. Decision 17 settled
 * that (eight residential expansions returned 302, no throttling) and asserted
 * that React Native's `fetch` ignores `redirect: 'manual'` on iOS, so the
 * header could only be read from a native `URLSession` delegate.
 *
 * That last part was reasoning, not measurement. This module tests it. If the
 * manual path works, the native module in todo.md section 5 never needs to be
 * built; if it does not, `observed` says exactly how it failed, which is the
 * information that decision was missing.
 *
 * Three attempts, best first:
 *
 *   1. `redirect: 'manual'` and read `Location`. Nothing Google renders is
 *      fetched, so the consent wall is never reached. This is the one we want.
 *   2. The redirect was followed anyway — take `response.url`, the address we
 *      landed on. Costs a page load, but a maps URL is a maps URL.
 *   3. We landed on the consent wall, which carries the real destination in
 *      its `continue=` parameter.
 */

export type Expansion =
  | { kind: 'expanded'; url: string; via: 'location' | 'final-url' | 'continue' }
  | { kind: 'failed'; reason: string; observed: string | null };

const isMapsUrl = (value: string): boolean => {
  try {
    const { hostname } = new URL(value);
    return /(^|\.)google\.[a-z.]+$/.test(hostname) && hostname !== 'consent.google.com';
  } catch {
    return false;
  }
};

export async function expandShortLink(url: string): Promise<Expansion> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      // Google serves a different chain to things that look automated.
      headers: { 'Accept-Language': 'en' },
    });
  } catch (error) {
    // No network, DNS failure, TLS — capture refused, nothing queued
    // (decision 21).
    return {
      kind: 'failed',
      reason: 'offline',
      observed: error instanceof Error ? error.message : String(error),
    };
  }

  // 1. The redirect was NOT followed. This is the outcome decision 17 wanted.
  const location = response.headers.get('location');
  if (location && isMapsUrl(location)) {
    return { kind: 'expanded', url: location, via: 'location' };
  }

  // 2. It was followed. `url` is wherever we ended up.
  const landed = response.url ?? null;
  if (landed && isMapsUrl(landed)) {
    return { kind: 'expanded', url: landed, via: 'final-url' };
  }

  // 3. The consent wall, which names its destination.
  if (landed) {
    try {
      const carried = new URL(landed).searchParams.get('continue');
      if (carried && isMapsUrl(carried)) {
        return { kind: 'expanded', url: carried, via: 'continue' };
      }
    } catch {
      // Not a parseable URL; fall through to the report below.
    }
  }

  return {
    kind: 'failed',
    reason: `status ${response.status}`,
    observed: location ?? landed,
  };
}
