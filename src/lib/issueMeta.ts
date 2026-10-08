import { humaniseToken } from './format';

/**
 * Presentation metadata for issue statuses and categories.
 *
 * Two accessibility rules are enforced here rather than left to each call site:
 *
 * - **Status is never colour alone.** Every badge carries a text label and a
 *   glyph whose *shape* differs per status, so the four states remain
 *   distinguishable in greyscale and to colour-blind users (WCAG 2.1 §1.4.1).
 * - **No hard-coded hexes.** Colours come from the `@theme` tokens in
 *   `index.css` — Tailwind utilities for chips, and `.weft-pin--*` CSS classes
 *   for map markers, which read the same custom properties. A brand change
 *   happens in one file.
 */
export interface StatusMeta {
  /** The raw wire value, for form controls and comparisons. */
  value: string;
  /** Human label, e.g. `In Progress`. */
  label: string;
  /** Tailwind utilities for the badge chip. */
  badgeClass: string;
  /** Modifier appended to `.weft-pin` for the map marker. */
  pinModifier: string;
  /** Shape cue that differs per status, so colour is never the only signal. */
  glyph: string;
  /** What the status means, for tooltips and the map legend. */
  description: string;
}

const STATUS_META: Record<string, StatusMeta> = {
  REPORTED: {
    value: 'REPORTED',
    label: 'Reported',
    badgeClass: 'bg-orange/12 text-orange-dark border-orange/40',
    pinModifier: 'reported',
    glyph: '◆',
    description: 'Submitted by a citizen, not yet picked up',
  },
  IN_PROGRESS: {
    value: 'IN_PROGRESS',
    label: 'In Progress',
    badgeClass: 'bg-teal/12 text-teal-dark border-teal/40',
    pinModifier: 'in-progress',
    glyph: '▶',
    description: 'Accepted and being worked on',
  },
  RESOLVED: {
    value: 'RESOLVED',
    label: 'Resolved',
    badgeClass: 'bg-success/12 text-success-dark border-success/40',
    pinModifier: 'resolved',
    glyph: '✓',
    description: 'Fixed and closed',
  },
  REJECTED: {
    value: 'REJECTED',
    label: 'Rejected',
    badgeClass: 'bg-danger/12 text-danger-dark border-danger/40',
    pinModifier: 'rejected',
    glyph: '✕',
    description: 'Not actionable — duplicate, out of scope, or unfounded',
  },
};

const UNKNOWN_STATUS: StatusMeta = {
  value: '',
  label: 'Unknown',
  badgeClass: 'bg-surface-secondary text-text-secondary border-border',
  pinModifier: 'unknown',
  glyph: '•',
  description: 'The API did not report a status for this issue',
};

/**
 * Look up presentation metadata for a status.
 *
 * An unrecognised value is rendered as itself in neutral styling rather than
 * being dropped — if the backend adds a status this build predates, staff
 * still see what it is instead of a blank cell.
 */
export const statusMeta = (status: string | null): StatusMeta => {
  if (!status) return UNKNOWN_STATUS;
  const known = STATUS_META[status];
  if (known) return known;
  return { ...UNKNOWN_STATUS, value: status, label: humaniseToken(status) };
};

/** `GARBAGE_ACCUMULATION` → `Garbage Accumulation`; unknown values pass through. */
export const categoryLabel = (category: string | null): string =>
  category ? humaniseToken(category) : '—';

/**
 * CSS custom property holding a category's marker colour.
 *
 * Lives here rather than beside `CategoryIcon` so that component file exports
 * only a component — a file mixing the two breaks React Fast Refresh, and the
 * category metadata all belongs together anyway.
 */
export const categoryColorVar = (category: string | null): string => {
  const key: Record<string, string> = {
    POTHOLE: '--color-cat-pothole',
    GARBAGE_ACCUMULATION: '--color-cat-garbage',
    WATER_LOGGING: '--color-cat-water',
    BROKEN_STREET_LIGHT: '--color-cat-light',
    DAMAGED_FOOTPATH: '--color-cat-footpath',
    SEWAGE_OVERFLOW: '--color-cat-sewage',
    OTHER: '--color-cat-other',
  };
  return key[category ?? ''] ?? '--color-cat-other';
};
