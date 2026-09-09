// Does MapKit find the places Google gives us?
//
// Decision 18 makes MKLocalSearch the PRIMARY source of coordinates, because
// nine real iOS Maps links carried a full postal address and no coordinates.
// That decision rests on an argument, not on evidence. This measures it.
//
//   swift scripts/geocode-test.swift
//
// Needs network, so run it in your own terminal (not through Claude — that
// sandbox has no egress). Watch two things: the hit rate, and the Bar But
// distance. "Found something" is not the same as "found the right thing".

import MapKit
import Foundation

let places = [
  ("Bar But", "Carrer de Bonavista, 8, Gràcia, 08012 Barcelona, Spain"),
  ("Bar La Fuente", "C. Nuestra Señora, 8, 39700 Castro-Urdiales, Cantabria, Spain"),
  ("De Mirandabad", "De Mirandalaan 9, 1079 PA Amsterdam, Netherlands"),
  ("Le Relais de l'Entrecôte", "20 Rue Saint-Benoît, 75006 Paris, France"),
  ("Royal Botanic Gardens", "Kew, Richmond, United Kingdom"),
  ("Royal China (Baker Street)", "24-26 Baker St, London W1U 3BZ, United Kingdom"),
  ("The Foreign Affair Winery", "4890 Victoria Ave N, Vineland Station, ON L0R 2E0"),
  ("RPM Bakehouse", "3839 Main St, Jordan, ON L0R 1S0"),
  ("Bar Isabel", "797 College St, Toronto, ON M6G 1C7"),
]

// Google's own pin for Bar But, taken from the place-card link. The only
// ground truth we have; for the rest we can only eyeball the matched name.
let truth = CLLocation(latitude: 41.397982, longitude: 2.15936)

var hits = 0

for (name, address) in places {
  let request = MKLocalSearch.Request()
  request.naturalLanguageQuery = "\(name), \(address)"

  var finished = false
  MKLocalSearch(request: request).start { response, error in
    defer { finished = true }

    guard let item = response?.mapItems.first else {
      print("MISS  \(name) — \(error?.localizedDescription ?? "no results")")
      return
    }
    hits += 1
    let c = item.placemark.coordinate  // deprecated on macOS 26 — the app should use item.location / item.address
    var line = String(format: "HIT   %@ → %.6f, %.6f   matched as: %@",
                      name, c.latitude, c.longitude, item.name ?? "?")
    if name == "Bar But" {
      let metres = CLLocation(latitude: c.latitude, longitude: c.longitude).distance(from: truth)
      line += String(format: "\n      ↳ %.0f m from Google's pin", metres)
    }
    print(line)
  }

  // A command-line tool has no run loop of its own; MapKit needs one to
  // deliver the callback.
  while !finished { RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.1)) }
}

print("\n\(hits)/\(places.count) found")
