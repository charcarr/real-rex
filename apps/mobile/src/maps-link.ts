/**
 * Google Maps link parsing.
 *
 * Adding a spot means pasting (or sharing) a Google Maps link. This module
 * turns that link into fields we can store. It is the highest-risk part of the
 * product, so it lives on its own, has no dependencies, touches no network and
 * is tested against real links captured from the iOS Maps app.
 *
 * ## What this module does NOT do
 *
 * It does not expand short links. `maps.app.goo.gl/…` carries no data at all —
 * something has to follow the redirect to reach the long URL. That step is
 * deliberately excluded here because it is a network call with a policy
 * question attached: Google's robots.txt disallows automated fetching of those
 * links, so it happens once, on the user's own device, for a link that user is
 * holding. Never from our servers. See decision 17.
 *
 * ## The shapes, all observed in the wild
 *
 *   1. Place card
 *      /maps/place/Bar+But/@41.40,2.14,15z/data=!3m5!1s0x…:0x…!8m2!3d41.397982!4d2.15936!16s/g/11bccd3m9t
 *      -> name, exact coordinates, feature id, knowledge-graph id
 *
 *   2. Dropped pin
 *      /maps/search/52.358927,+4.918140
 *      -> coordinates only, no name, no identifier
 *
 *   3. iOS share (entry=gps)
 *      maps.google.com/?q=Bar+But,+Carrer+de+Bonavista,+8,+…&ftid=0x…:0x…
 *      -> name AND full postal address, feature id, but NO COORDINATES
 *
 * Shape 3 is why geocoding is load-bearing rather than a fallback: the primary
 * sharing path on iOS can hand us a place with no coordinates in it. The
 * consolation is that it hands us a full street address instead, which
 * geocodes far more reliably than a bare place name would.
 *
 * ## Two traps worth knowing before editing this file
 *
 * The `@lat,lng,zoom` in the path is the MAP VIEWPORT CENTRE, not the pin. In
 * our two real samples it sat 791m and 940m away from the actual place. Never
 * read coordinates from it. They come from `!3d`/`!4d`, or from a literal
 * coordinate pair, or not at all.
 *
 * Coordinate pairs are written `52.358927,+4.918140`. That `+` is a literal
 * character in the path, not an encoded space, and a naive regex rejects it.
 */

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

/** Hosts that serve short links. These carry no data and must be expanded. */
const SHORT_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl']);

/**
 * The feature id, in either of the two places Google puts it: inline in a
 * place URL's `data=` block, or as a top-level `ftid=` parameter on a share
 * URL. Format is `<cell id>:<feature id>`; the right half, in decimal, is the
 * CID — the identifier that survives across every link shape we have seen.
 */
const FTID = /(?:!1s|[?&]ftid=)(0x[0-9a-f]+:0x[0-9a-f]+)/i;

/** A real Places API id. Only ever appears in developer-built URLs. */
const PLACE_ID = /!1s(ChIJ[\w-]+)/;

/** The actual pin. Not to be confused with the `@` viewport centre. */
const PIN = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/;

/** Knowledge-graph machine id, matched after percent-decoding. */
const KG_MID = /!16s(\/[gm]\/[\w-]+)/i;

/** A CID given directly — the form our own `canonicalUrl` emits. */
const CID_PARAM = /[?&]cid=(\d+)/;

/** A bare coordinate pair. The optional `+` is a literal, see the note above. */
const LAT_LNG = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*\+?\s*(-?\d+(?:\.\d+)?)\s*$/;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Which namespace `ref` is expressed in. They are not interconvertible. */
export type PlaceRefType = 'place_id' | 'cid' | 'kg_mid';

/** Where coordinates came from, so a caller can judge how much to trust them. */
export type CoordSource = 'pin' | 'literal';

export interface ParsedPlace {
  kind: 'place';
  /**
   * Google's display name at the time the link was made. Always editable, and
   * null when the link identifies a place without naming it — a `?cid=` URL
   * does exactly that, and so does our own canonical form.
   */
  name: string | null;
  /** Full postal address, when the link shape carries one. Good geocoder input. */
  address: string | null;
  lat: number | null;
  lng: number | null;
  coordSource: CoordSource | null;
  /** Stable identifier for this place, in whichever namespace we got. */
  ref: string | null;
  refType: PlaceRefType | null;
  /** Rebuilt from the identifier — never the pasted string, which carries
   *  per-share junk (skid, g_ep, g_st, lucs, shh, entry, utm_*). */
  canonicalUrl: string;
  /** True when the caller must resolve coordinates itself, e.g. MKLocalSearch. */
  needsGeocode: boolean;
}

export interface ParsedPin {
  kind: 'pin';
  lat: number;
  lng: number;
  coordSource: CoordSource;
  canonicalUrl: string;
}

/** A short link. Carries nothing; expand it on-device, then parse the result. */
export interface ParsedShort {
  kind: 'short';
  url: string;
}

export interface ParsedUnsupported {
  kind: 'unsupported';
  reason: string;
}

export type ParsedMapsLink = ParsedPlace | ParsedPin | ParsedShort | ParsedUnsupported;

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** True for a link that must be expanded before it can tell us anything. */
export function isShortMapsLink(input: string): boolean {
  try {
    return SHORT_HOSTS.has(new URL(input.trim()).hostname);
  } catch {
    return false;
  }
}

export function parseMapsLink(input: string): ParsedMapsLink {
  let url: URL;
  try {
    url = new URL(String(input).trim());
  } catch {
    return { kind: 'unsupported', reason: 'not a url' };
  }

  if (SHORT_HOSTS.has(url.hostname)) return { kind: 'short', url: url.href };
  if (!/(^|\.)google\.[a-z.]+$/.test(url.hostname)) {
    return { kind: 'unsupported', reason: `not a google host: ${url.hostname}` };
  }

  // Percent-decode once, up front: `!16s%2Fg%2F11…` only matches KG_MID after
  // decoding, and the name segment needs it too.
  let decoded: string;
  try {
    decoded = decodeURIComponent(url.href);
  } catch {
    decoded = url.href; // malformed escapes; carry on with the raw string
  }

  const segments = url.pathname.split('/').filter(Boolean);
  const query = url.searchParams.get('q') ?? url.searchParams.get('query') ?? '';

  const { ref, refType } = readIdentifier(decoded);
  const coords = readCoordinates(decoded, segments, query);
  const named = readName(segments, query);

  // A link is usable if it names a place, identifies one, or points at a
  // coordinate. Only the empty intersection of all three is unsupported.
  if (!named && !ref) {
    if (!coords) {
      return { kind: 'unsupported', reason: 'no place name, identifier or coordinates' };
    }
    return {
      kind: 'pin',
      lat: coords.lat,
      lng: coords.lng,
      coordSource: coords.source,
      canonicalUrl: coordinateUrl(coords.lat, coords.lng),
    };
  }

  return {
    kind: 'place',
    name: named?.name ?? null,
    address: named?.address ?? null,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    coordSource: coords?.source ?? null,
    ref,
    refType,
    canonicalUrl:
      refType === 'cid' && ref
        ? `https://maps.google.com/?cid=${ref}`
        : coords
          ? coordinateUrl(coords.lat, coords.lng)
          : searchUrl([named?.name, named?.address].filter(Boolean).join(', ')),
    needsGeocode: coords === null,
  };
}

// ---------------------------------------------------------------------------
// Field readers
// ---------------------------------------------------------------------------

/**
 * Identifiers, in descending order of usefulness. A real Places id wins if it
 * is somehow present; otherwise the CID, which is the one the iOS share path
 * actually produces; otherwise the knowledge-graph id.
 */
function readIdentifier(decoded: string): { ref: string | null; refType: PlaceRefType | null } {
  const placeId = decoded.match(PLACE_ID)?.[1];
  if (placeId) return { ref: placeId, refType: 'place_id' };

  const ftid = decoded.match(FTID)?.[1];
  if (ftid) {
    const half = ftid.split(':')[1];
    if (half) {
      try {
        return { ref: BigInt(half).toString(), refType: 'cid' };
      } catch {
        // Not valid hex. Fall through rather than throwing on a hostile input.
      }
    }
  }

  const cid = decoded.match(CID_PARAM)?.[1];
  if (cid) return { ref: cid, refType: 'cid' };

  const mid = decoded.match(KG_MID)?.[1];
  if (mid) return { ref: mid, refType: 'kg_mid' };

  return { ref: null, refType: null };
}

function readCoordinates(
  decoded: string,
  segments: string[],
  query: string,
): { lat: number; lng: number; source: CoordSource } | null {
  const pin = decoded.match(PIN);
  if (pin?.[1] && pin[2]) return { lat: Number(pin[1]), lng: Number(pin[2]), source: 'pin' };

  // `/maps/search/52.358927,+4.918140` or `?q=52.35,4.91`
  const candidates = [decodeSafe(segments[segments.length - 1] ?? ''), query];
  for (const candidate of candidates) {
    const match = candidate.match(LAT_LNG);
    if (match?.[1] && match[2]) {
      return { lat: Number(match[1]), lng: Number(match[2]), source: 'literal' };
    }
  }
  return null;
}

/**
 * The name comes either from the `/place/<name>/` segment or from a `?q=` that
 * holds "Name, Street, Number, District, Postcode City, Country".
 *
 * Splitting that on the first comma is a heuristic, and it is wrong when the
 * shared thing is an address with no business at it — you get a street name
 * where you wanted a place name. That is acceptable because the field is
 * always editable, and being editable is required anyway: Google's display
 * name is sometimes useless on its own ("4850").
 */
function readName(
  segments: string[],
  query: string,
): { name: string; address: string | null } | null {
  if (segments[0] === 'maps' && segments[1] === 'place') {
    const segment = segments[2];
    if (segment) {
      const name = decodeSafe(segment).replace(/\+/g, ' ').trim();
      if (name && !LAT_LNG.test(name)) return { name, address: null };
    }
  }

  if (query && !LAT_LNG.test(query)) {
    const parts = query
      .replace(/\+/g, ' ')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const name = parts.shift();
    if (name) return { name, address: parts.length ? parts.join(', ') : null };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const coordinateUrl = (lat: number, lng: number): string =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

const searchUrl = (term: string): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(term)}`;

function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
