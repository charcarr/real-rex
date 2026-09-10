import { expandShortLink } from './expand-link';
import { makeId } from './id';
import { parseMapsLink, type ParsedMapsLink, type PlaceRefType } from './maps-link';

/**
 * A saved spot, as the device holds it.
 *
 * These fields are the ones `list_item` carries, so that publishing later is a
 * mapping and not a translation. `id`, `createdAt` and `updatedAt` exist from
 * version one on purpose (decision 28): retrofitting stable ids onto records
 * already on people's phones is the painful version of this problem.
 */
export interface Spot {
  id: string;
  title: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  placeRef: string | null;
  placeRefType: PlaceRefType | null;
  /**
   * The one line that appears under the name on the public page. Empty until
   * the editing pass -- capture is a burst and does not ask for words
   * (decision 21). "Needs a note" is derived from this being empty, never
   * from a stored flag.
   */
  shortNote: string | null;
  /** The paragraph behind the disclosure on the public page. Optional. */
  longNote: string | null;
  /** The rebuilt canonical link, never the pasted string. */
  googleMapsUrl: string;
  /** True until MapKit resolves coordinates. Nothing does that yet. */
  needsGeocode: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Why a paste did not produce a spot. Each has a different fix, so each has
 *  its own message — decision 21. */
export type AddFailure =
  | { kind: 'duplicate'; spot: Spot }
  | { kind: 'offline' }
  /** The redirect could not be followed. `observed` is the diagnostic. */
  | { kind: 'expansion-failed'; reason: string; observed: string | null }
  | { kind: 'unparseable' };

export type AddResult = { kind: 'added'; spot: Spot } | AddFailure;

/** Two spots are the same place when they carry the same identifier, or when
 *  the link canonicalises to the same URL. */
const isSame = (a: Spot, b: Spot): boolean =>
  (a.placeRef !== null && a.placeRef === b.placeRef) || a.googleMapsUrl === b.googleMapsUrl;

export async function addFromLink(existing: Spot[], input: string): Promise<AddResult> {
  let parsed: ParsedMapsLink = parseMapsLink(input);

  // Short links carry nothing at all — the redirect has to be followed once,
  // here on the device, before there is anything to read (decision 17).
  if (parsed.kind === 'short') {
    const expansion = await expandShortLink(parsed.url);
    if (expansion.kind === 'failed') {
      return expansion.reason === 'offline'
        ? { kind: 'offline' }
        : {
            kind: 'expansion-failed',
            reason: expansion.reason,
            observed: expansion.observed,
          };
    }
    // TEMPORARY. Which of the three paths worked decides whether the native
    // URLSession module from decision 17 has to exist -- and 'location' is the
    // only one that reads the header without loading anything Google renders.
    console.log('[expand]', expansion.via, expansion.url);

    parsed = parseMapsLink(expansion.url);
    if (parsed.kind === 'short') return { kind: 'unparseable' };
  }

  if (parsed.kind === 'unsupported') return { kind: 'unparseable' };

  const now = new Date().toISOString();

  const spot: Spot =
    parsed.kind === 'pin'
      ? {
          id: makeId('spot'),
          title: 'Dropped pin',
          address: null,
          latitude: parsed.lat,
          longitude: parsed.lng,
          placeRef: null,
          placeRefType: null,
          shortNote: null,
          longNote: null,
          googleMapsUrl: parsed.canonicalUrl,
          needsGeocode: false,
          createdAt: now,
          updatedAt: now,
        }
      : {
          id: makeId('spot'),
          // Google's name is sometimes useless on its own ("4850"), so the
          // title is always editable — the address is the fallback label.
          title: parsed.name ?? parsed.address ?? 'Untitled place',
          address: parsed.address,
          latitude: parsed.lat,
          longitude: parsed.lng,
          placeRef: parsed.ref,
          placeRefType: parsed.refType,
          shortNote: null,
          longNote: null,
          googleMapsUrl: parsed.canonicalUrl,
          needsGeocode: parsed.needsGeocode,
          createdAt: now,
          updatedAt: now,
        };

  // A repeated paste is expected and is not an error (decision 21).
  const already = existing.find((s) => isSame(s, spot));
  if (already) return { kind: 'duplicate', spot: already };

  return { kind: 'added', spot };
}
