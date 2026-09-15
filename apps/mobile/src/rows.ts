import { resolveAll, type List } from './lists.ts';
import type { Spot } from './spots.ts';

/**
 * The device document, as `list_item` rows.
 *
 * Decision 30: a published item carries its own copy of the words, so this is
 * where "library default, per-list override" stops being a live relationship
 * and becomes a snapshot. `resolveAll` does the resolving; this only maps.
 *
 * Pure on purpose. It is the piece most likely to be wrong in a way that a
 * simulator would not show you -- an off-by-one in `position`, a coordinate
 * sent alone -- and every line of it runs under `node --test`.
 */

/** One row, minus the two columns only the publish path knows. */
export interface ItemRow {
  position: number;
  title: string;
  short_note: string | null;
  long_note: string | null;
  google_maps_url: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
}

export function toRows(list: List, library: readonly Spot[]): ItemRow[] {
  return resolveAll(list, library).map((item, index) => {
    // `list_item_latlng_together` says both or neither, and a half-geocoded
    // spot would otherwise fail the whole insert at the last moment.
    const located = item.spot.latitude !== null && item.spot.longitude !== null;

    return {
      // Decision 15: the numeral is the row's rank, so position is assigned
      // here, from the order of the array, and is stored nowhere on the device.
      position: index + 1,
      title: item.title,
      short_note: item.shortNote,
      long_note: item.longNote,
      google_maps_url: item.spot.googleMapsUrl,
      latitude: located ? item.spot.latitude : null,
      longitude: located ? item.spot.longitude : null,
      address: item.spot.address,
    };
  });
}
