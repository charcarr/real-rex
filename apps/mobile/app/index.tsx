import { useState } from 'react';

import { AddSpotsSheet } from '../src/components/AddSpotsSheet';
import { NewUserHome } from '../src/screens/NewUserHome';
import type { Spot } from '../src/spots';

/**
 * Home.
 *
 * The library lives in component state for now. It moves behind the storage
 * module when that lands (decision 28) — this is the only place that holds it,
 * so that swap touches one file.
 */
export default function HomeRoute() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [adding, setAdding] = useState(false);

  return (
    <>
      <NewUserHome onPasteFirstPlace={() => setAdding(true)} />
      <AddSpotsSheet
        visible={adding}
        spots={spots}
        onAdd={(spot) => setSpots((current) => [...current, spot])}
        onClose={() => setAdding(false)}
      />
    </>
  );
}
