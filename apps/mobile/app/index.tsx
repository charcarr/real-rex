import { useState } from 'react';

import { AddSpotsSheet } from '../src/components/AddSpotsSheet';
import { fillInMissing } from '../src/geocode';
import { Home } from '../src/screens/Home';
import type { Spot } from '../src/spots';

/**
 * Home.
 *
 * One screen in both states — the header and the paste bar are constant, and
 * the middle is either the getting-started checklist or the lists themselves.
 *
 * The library lives in component state for now. It moves behind the storage
 * module when that lands (decision 28) — this is the only place that holds it,
 * so that swap touches one file.
 */
export default function HomeRoute() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [locating, setLocating] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  /**
   * Two writes per spot, and that is not optional (decision 21): the row has to
   * appear the moment the link parses, so the geocoder runs after it is on
   * screen and patches it when it answers.
   */
  const add = async (spot: Spot) => {
    setSpots((current) => [...current, spot]);
    setLocating((current) => [...current, spot.id]);

    const filled = await fillInMissing(spot);
    if (filled) {
      setSpots((current) => current.map((s) => (s.id === filled.id ? filled : s)));
    }
    setLocating((current) => current.filter((id) => id !== spot.id));
  };

  return (
    <>
      <Home
        hasPlaces={spots.length > 0}
        // No list model yet — the rows arrive with the builder.
        hasLists={false}
        onPastePlace={() => setAdding(true)}
        // The builder is not built — todo.md section 6.
        onCreateList={undefined}
      />
      <AddSpotsSheet
        visible={adding}
        spots={spots}
        locating={locating}
        onAdd={add}
        onClose={() => setAdding(false)}
      />
    </>
  );
}
