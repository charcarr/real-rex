import * as Location from 'expo-location';

import type { Spot } from './spots';

/**
 * Filling in whatever the link left out.
 *
 * The two link shapes are exactly complementary, and a user only ever pastes
 * one of them:
 *
 *   expanded short link  ->  name + coordinates, no address
 *   iOS share            ->  name + address, no coordinates
 *
 * So this runs in whichever direction is needed. On iOS both go to Apple's
 * geocoder, which is the MapKit decision 18 chose — reached through Expo's
 * wrapper rather than a hand-written module.
 *
 * Nothing here is load-bearing: a spot that fails to geocode is still a spot.
 * Failures are swallowed and the row keeps what the link gave it.
 *
 * Android needs `requestForegroundPermissionsAsync` before either call. iOS
 * does not, and Android is not in the MVP (decision 8), so it is not requested
 * here — that lands with Android support.
 */

/**
 * Apple returns address parts, not a formatted line, and the order those parts
 * go in differs by country ("797 College St" but "Camperstraat 48-50"). iOS
 * puts the locally-correct street line in `name`, so that is preferred and the
 * parts are only a fallback.
 */
function formatAddress(place: Location.LocationGeocodedAddress): string | null {
  const streetLine =
    place.name ?? [place.street, place.streetNumber].filter(Boolean).join(' ') ?? null;
  const cityLine = [place.postalCode, place.city].filter(Boolean).join(' ');
  const line = [streetLine, cityLine].filter(Boolean).join(', ');
  return line.length > 0 ? line : null;
}

/**
 * Returns a spot with the missing half filled in, or `null` when there was
 * nothing to do or the geocoder could not help.
 */
export async function fillInMissing(spot: Spot): Promise<Spot | null> {
  try {
    // No coordinates: the iOS share shape. The address geocodes far more
    // reliably than a bare place name, which is sometimes "4850".
    if (spot.latitude === null || spot.longitude === null) {
      const query = spot.address ?? spot.title;
      const [match] = await Location.geocodeAsync(query);
      if (!match) return null;
      return {
        ...spot,
        latitude: match.latitude,
        longitude: match.longitude,
        needsGeocode: false,
        updatedAt: new Date().toISOString(),
      };
    }

    // No address: the expanded-short-link shape.
    if (spot.address === null) {
      const [place] = await Location.reverseGeocodeAsync({
        latitude: spot.latitude,
        longitude: spot.longitude,
      });
      if (!place) return null;
      const address = formatAddress(place);
      if (!address) return null;
      return { ...spot, address, updatedAt: new Date().toISOString() };
    }

    return null;
  } catch {
    // Offline, rate-limited, or no result. The spot stands as it is.
    return null;
  }
}
