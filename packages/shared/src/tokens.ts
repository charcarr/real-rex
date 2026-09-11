/**
 * Design tokens — the single source of truth for colour, spacing and type.
 *
 * Two layers, deliberately:
 *
 *   1. `palette` — raw values. NEVER referenced from a component.
 *   2. `light` / `dark` — semantic roles. What a colour is FOR, not what it
 *      looks like. Components only ever read these.
 *
 * That split is what makes dark mode a one-object swap rather than a refactor.
 * A component that says `accent` keeps working when the accent changes; a
 * component that says `green500` does not.
 *
 * React Native imports these directly. Tailwind v4 pulls them into `@theme`.
 * One definition, so the app and the public page can never disagree.
 */

// ---------------------------------------------------------------------------
// Layer 1 — primitives
// ---------------------------------------------------------------------------

const palette = {
  // Cool neutrals. Deliberately NOT warm — the brand register is precise and
  // modern (Linear, Apple), and warm greige read as dull in testing.
  neutral0: '#FFFFFF',
  neutral50: '#FBFBFC',
  neutral100: '#F4F4F5',
  neutral200: '#E6E6E9',
  neutral400: '#A1A1A6',
  neutral500: '#65656B',
  neutral600: '#5E5E66',
  neutral700: '#9C9CA4',
  neutral800: '#26262B',
  neutral900: '#141417',
  neutral950: '#09090B',
  ink: '#0A0A0B',
  paper: '#FAFAFA',

  // Emerald. Chosen over Apple's system green (#34C759) so the brand owns a
  // colour rather than borrowing the OS one — the public web page is the most
  // seen surface, and there "iOS system green" means nothing.
  green500: '#22C55E',
  green600: '#16A34A',
  green400: '#4ADE80',
} as const;

// ---------------------------------------------------------------------------
// Layer 2 — semantic roles
// ---------------------------------------------------------------------------

/**
 * The role contract.
 *
 * Declared, not inferred. `typeof light` made one palette the accidental
 * specification, and because it is `as const` every role was typed as its own
 * hex literal — which is why `dark` did not read as a second palette but as a
 * type error. The roles are the contract; the hex values implement it.
 *
 * A role added here fails BOTH palettes until both define it. That is the
 * point: a role only one scheme implements is a bug waiting for the other
 * theme.
 */
export type ColorScheme = {
  readonly background: string;
  readonly surface: string;
  readonly border: string;

  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textMuted: string;

  /** Fills, rings, icons, large numerals. NOT small text — see the rule below. */
  readonly accent: string;
  /** The only green permitted on small text against a light background. */
  readonly accentText: string;
  /** The rex is ink on light grounds and green on dark ones. */
  readonly brandMark: string;
};

export const light = {
  background: palette.neutral50,
  surface: palette.neutral0,
  border: palette.neutral200,

  textPrimary: palette.ink,
  textSecondary: palette.neutral500,
  textMuted: palette.neutral400,

  accent: palette.green500,
  accentText: palette.green600,
  brandMark: palette.ink,
} as const satisfies ColorScheme;

export const dark = {
  background: palette.neutral950,
  surface: palette.neutral900,
  border: palette.neutral800,

  textPrimary: palette.paper,
  textSecondary: palette.neutral700,
  textMuted: palette.neutral600,

  accent: palette.green400,
  accentText: palette.green400,
  brandMark: palette.green400,
} as const satisfies ColorScheme;

/**
 * CONTRAST RULE — do not break this without measuring.
 *
 * Every usable green fails WCAG AA as body text on a light background:
 *
 *   #22C55E on #FFFFFF -> 2.28:1   (AA body text needs 4.5)
 *   #16A34A on #FFFFFF -> 3.30:1   (AA large/bold text needs 3.0)
 *
 * So on light grounds: green is for fills, rings, icons and large numerals
 * only. Small green text uses `accentText` (#16A34A) and must be >= 18.66px
 * bold or 24px regular. Body copy is always `textPrimary` / `textSecondary`.
 *
 * On dark grounds the same greens clear 9:1, so the constraint does not apply.
 */

// ---------------------------------------------------------------------------
// Spacing — a 4pt grid. Use these, never arbitrary numbers.
// ---------------------------------------------------------------------------

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

// ---------------------------------------------------------------------------
// Typography — system fonts only.
//
// No webfont, on purpose: the public list page is opened cold, from a chat
// app, on mobile data. Every font file is a delay before your friend sees the
// list. System stacks render instantly and are genuinely good.
// ---------------------------------------------------------------------------

export const fonts = {
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  /** Metadata and index numbers only — never body copy. */
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
} as const;

export const fontSize = {
  xs: 9,
  sm: 11.5,
  base: 12.5,
  md: 14,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 29,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/** Tight tracking on large text; system fonts space large sizes too loosely. */
export const letterSpacing = {
  tightest: -0.9,
  tight: -0.4,
  normal: 0,
  wide: 1.8,
} as const;

// ---------------------------------------------------------------------------
// Product constants
// ---------------------------------------------------------------------------

/**
 * The hard cap. Enforced structurally in Postgres as well — this constant is
 * for UI only and is NOT the thing that guarantees the rule.
 */
export const MAX_SPOTS_PER_LIST = 5;

/**
 * The one line on the public page, capped so that what you type is what your
 * friend reads rather than something the page decides to end with an ellipsis.
 *
 * STILL NOBODY'S NUMBER. It was invented while building the first note editor
 * and has never been chosen. Worth setting against real notes before the
 * first release.
 */
export const SHORT_NOTE_MAX = 80;
