# Design

The rules and the reasoning. If you are about to pick a colour, a size or a
spacing value, it is in `packages/shared/src/tokens.ts` — use it, don't invent
one.

## Register

**Precise and modern, not warm and editorial.** The references are Linear and
Vercel for structure, Apple and Airbnb for generosity and clarity.

We tried and rejected a warm editorial direction (serif headlines, beige paper,
masthead rules). It was well built and wrong: it read as a newspaper, and this
product is a friend handing you five places, not a broadsheet.

**Light-first, with a dark mode that is genuinely good** — not an inverted
afterthought. Both are defined side by side in the tokens.

## The page

The public list page is the most important surface in the product. It is the
only thing non-users ever see, it is what gets forwarded, and it is opened cold
on mobile data from a chat app.

Layout — "precision list":

- Cool near-white ground (`background`), white rows (`surface`), hairline
  borders (`border`). No shadows.
- Section label in mono, letterspaced, muted.
- Headline at `3xl`, semibold, tight tracking.
- One row per spot: a large green numeral, the place name, one line of note.
- Footer is the lockup and nothing else: the rex plus the words "Real Rex".

## Colour

Emerald, not Apple's system green. `#34C759` is the colour of iOS toggles — the
app would be indistinguishable from OS chrome, and on the web it carries no
meaning at all. A brand should own its colour.

**The contrast rule.** Every usable green fails AA as body text on white:

|           | on white               | on dark surface |
| --------- | ---------------------- | --------------- |
| `#22C55E` | 2.28 ✗                 | 9.76 ✓          |
| `#16A34A` | 3.30 ⚠ large/bold only | —               |

So on light grounds green is for **fills, rings, icons and large numerals**.
Small green text uses `accentText` and must be large or bold. Body copy is
always `textPrimary` / `textSecondary`. On dark this does not apply.

## Typography

**System fonts only.** No webfont, deliberately: every font file is a delay
before someone's friend sees the list, and that first moment is the product.

Mono is for metadata and index numbers only, never body copy.

## The mark

A line-art t-rex, side profile facing right. `packages/shared/assets/real-rex.svg`.

- **Ink on light grounds, green on dark.** Green on near-white is 2.28:1 and
  the thin outlines disappear at small sizes.
- It is a single path filled with `currentColor`, so one CSS property recolours
  the whole mark.
- Legible down to about 56px. **Below that it needs a simplified variant** —
  the outlines are traced shapes, not strokes, so line weight scales with the
  drawing and thins out. A favicon-scale version is still to be drawn.

## Motion

Rows expand to reveal a longer description and a map.

- **Springs, not easing curves.** Physics with slight overshoot reads as
  expensive; linear easing reads as a 2015 website. Reanimated runs this on the
  UI thread, so it holds 120fps.
- **The numeral is the anchor.** It stays and moves when a row opens; it never
  disappears and reappears. Persistent elements across a state change are the
  strongest "well made" signal there is.
- **Stagger the reveal** — description, then map about 40ms later. Simultaneous
  arrival feels cheap.
- **Haptics on open** (`expo-haptics`, light impact).
- On the web the same effect needs no JavaScript: `grid-template-rows: 0fr ->
1fr` animates a height-auto disclosure, with `@starting-style` for entry.

## Still open

- Simplified small-size variant of the mark (favicon, 20-32px).
- Stroke-based redraw of the rex so limbs can be animated separately.
- No route back to the product from the page — the wordmark is a brand, not a
  destination. Anything screenshotted and forwarded is currently a dead end.
- Type scale has not been tested on a real device in daylight.
