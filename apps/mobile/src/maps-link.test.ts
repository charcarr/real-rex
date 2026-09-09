/**
 * Fixtures are REAL links, captured from the iOS Google Maps app and expanded
 * with `curl -sI` on a residential connection. Do not replace them with
 * hand-written URLs: every bug this suite has caught so far came from a shape
 * nobody would have invented — the literal `+` in a coordinate pair, and an
 * iOS share that carries a full postal address but no coordinates at all.
 *
 * Run: npm test --workspace @real-rex/shared
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseMapsLink, isShortMapsLink } from './maps-link.ts';

const LINKS = {
  /** Place card, Amsterdam. Name is a number, which is why names stay editable. */
  placeCard4850:
    'https://www.google.com/maps/place/4850/@52.3506772,4.913596,14.43z/data=!4m6!3m5!1s0x47c6099c873ba7cb:0xd9ed0fe173c1f6ac!8m2!3d52.3577937!4d4.913378!16s%2Fg%2F11g9nh62sc?entry=tts&g_ep=EgoyMDI2MDkwMi4wIPu8ASoASAFQAw%3D%3D&skid=9b1f04a3-5cce-4477-862d-a3816fc7030d',
  /** Dropped pin. Note the literal `+` between the coordinates. */
  droppedPin:
    'https://www.google.com/maps/search/52.358927,+4.918140?entry=tts&g_ep=EgoyMDI2MDkwMi4wIPu8ASoASAFQAw%3D%3D&skid=22661b7f-f183-48fd-8b8c-cea94391ac02',
  /** Place card, Barcelona. Same bar as `iosShare` below. */
  placeCardBarBut:
    'https://www.google.com/maps/place/Bar+But/@41.4008118,2.1487346,15.04z/data=!4m6!3m5!1s0x12a4a29684c1eec5:0xeea6335740e98ab1!8m2!3d41.397982!4d2.15936!16s%2Fg%2F11bccd3m9t?entry=tts&g_ep=EgoyMDI2MDkwMi4wIPu8ASoASAFQAw%3D%3D&skid=2c4fd1c2-2bae-43f1-b028-34adaf5f05d6',
  /** iOS share, entry=gps. Address but no coordinates. */
  iosShare:
    'https://maps.google.com/?q=Bar+But,+Carrer+de+Bonavista,+8,+Gr%C3%A0cia,+08012+Barcelona,+Spain&ftid=0x12a4a29684c1eec5:0xeea6335740e98ab1&entry=gps&shh=CAE&lucs=,94297699,94231188&g_ep=CAISEjI2LjMzLjEuOTYxODkxNDMyMBgAINeCAypT&skid=5cab37b6-92de-44f5-82ab-b1e2bc9d65b9',
  short: 'https://maps.app.goo.gl/nENkyEpxdm6yqRbC9?g_st=i&utm_campaign=ac-im',
} as const;

const BAR_BUT_CID = '17196488677005036209';

describe('place cards', () => {
  it('reads name, pin coordinates and the CID', () => {
    const r = parseMapsLink(LINKS.placeCard4850);
    assert.equal(r.kind, 'place');
    if (r.kind !== 'place') return;
    assert.equal(r.name, '4850');
    assert.equal(r.lat, 52.3577937);
    assert.equal(r.lng, 4.913378);
    assert.equal(r.coordSource, 'pin');
    assert.equal(r.refType, 'cid');
    assert.equal(r.ref, '15703224936694937260');
    assert.equal(r.needsGeocode, false);
  });

  it('never reads coordinates from the @ viewport centre', () => {
    // The viewport in this link sits 791m from the pin. Reading it would put
    // the spot in the wrong neighbourhood, and the page would look correct.
    const r = parseMapsLink(LINKS.placeCard4850);
    assert.equal(r.kind, 'place');
    if (r.kind !== 'place') return;
    assert.notEqual(r.lat, 52.3506772);
    assert.notEqual(r.lng, 4.913596);
  });

  it('strips per-share tracking junk from the canonical url', () => {
    const r = parseMapsLink(LINKS.placeCardBarBut);
    assert.equal(r.kind, 'place');
    if (r.kind !== 'place') return;
    for (const junk of ['skid', 'g_ep', 'entry', 'lucs', 'shh', 'utm_']) {
      assert.ok(!r.canonicalUrl.includes(junk), `canonical url still contains ${junk}`);
    }
  });
});

describe('the iOS share shape', () => {
  it('recovers name and full address but reports that it needs geocoding', () => {
    const r = parseMapsLink(LINKS.iosShare);
    assert.equal(r.kind, 'place');
    if (r.kind !== 'place') return;
    assert.equal(r.name, 'Bar But');
    assert.equal(r.address, 'Carrer de Bonavista, 8, Gràcia, 08012 Barcelona, Spain');
    assert.equal(r.lat, null);
    assert.equal(r.lng, null);
    assert.equal(r.needsGeocode, true);
    assert.equal(r.ref, BAR_BUT_CID);
  });

  it('identifies the same bar as the place card does', () => {
    // Two entirely different URL shapes, one identity. This is what makes it
    // possible to recognise a place later without a shared places table.
    const fromCard = parseMapsLink(LINKS.placeCardBarBut);
    const fromShare = parseMapsLink(LINKS.iosShare);
    assert.equal(fromCard.kind, 'place');
    assert.equal(fromShare.kind, 'place');
    if (fromCard.kind !== 'place' || fromShare.kind !== 'place') return;
    assert.equal(fromCard.ref, fromShare.ref);
    assert.equal(fromCard.ref, BAR_BUT_CID);
  });
});

describe('dropped pins', () => {
  it('parses a coordinate pair written with a literal +', () => {
    const r = parseMapsLink(LINKS.droppedPin);
    assert.equal(r.kind, 'pin');
    if (r.kind !== 'pin') return;
    assert.equal(r.lat, 52.358927);
    assert.equal(r.lng, 4.91814);
  });
});

describe('short links', () => {
  it('is reported as needing expansion rather than guessed at', () => {
    assert.equal(parseMapsLink(LINKS.short).kind, 'short');
    assert.equal(isShortMapsLink(LINKS.short), true);
    assert.equal(isShortMapsLink(LINKS.placeCard4850), false);
  });
});

describe('canonical urls round-trip', () => {
  it('a canonical url we emit parses back to the same identifier', () => {
    const first = parseMapsLink(LINKS.placeCardBarBut);
    assert.equal(first.kind, 'place');
    if (first.kind !== 'place') return;
    const second = parseMapsLink(first.canonicalUrl);
    assert.equal(second.kind, 'place');
    if (second.kind !== 'place') return;
    assert.equal(second.ref, first.ref);
  });
});

describe('hostile and malformed input', () => {
  for (const input of [
    '',
    'not a url',
    'https://example.com/foo',
    'https://www.google.com/maps',
    'javascript:alert(1)',
    'https://www.google.com/maps/place/%E0%A4%A/@1,2,3z',
  ]) {
    it(`does not throw on ${JSON.stringify(input)}`, () => {
      const r = parseMapsLink(input);
      assert.ok(['place', 'pin', 'short', 'unsupported'].includes(r.kind));
    });
  }
});

describe('identifier-only links', () => {
  it('accepts a ?cid= url as a place that still needs a name and coordinates', () => {
    // This is the shape our own canonicalUrl emits, and the shape of a
    // maps.google.com/?cid= link. It identifies a place without describing it.
    const r = parseMapsLink(`https://maps.google.com/?cid=${BAR_BUT_CID}`);
    assert.equal(r.kind, 'place');
    if (r.kind !== 'place') return;
    assert.equal(r.ref, BAR_BUT_CID);
    assert.equal(r.name, null);
    assert.equal(r.needsGeocode, true);
  });
});
