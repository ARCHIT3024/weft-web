import { categoryLabel } from '../lib/issueMeta';

/**
 * Inline SVG glyph per issue category.
 *
 * SVG rather than emoji, deliberately. The citizen mobile spec uses emoji, and
 * that is fine there; on the dashboard it is not. Emoji render differently on
 * every platform, cannot inherit `currentColor`, and are announced by screen
 * readers with their Unicode names ("hole", "wastebasket"), which is noise
 * sitting next to a perfectly good text label.
 *
 * Each path is a distinct silhouette, so category survives greyscale printing
 * and colour-blindness — the map colours categories, and this is the redundant
 * channel that keeps that legible.
 */

interface CategoryIconProps {
  category: string | null;
  className?: string;
  /** Set when a visible text label already names the category. */
  decorative?: boolean;
}

const PATHS: Record<string, string> = {
  // Pothole — a depression in a road surface.
  POTHOLE: 'M3 17h18M6 17c0-3 2-5 6-5s6 2 6 5M9 12.5 8 8m7 4.5L16 8',
  // Garbage — bin with lid.
  GARBAGE_ACCUMULATION: 'M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v5M14 11v5',
  // Water logging — waves.
  WATER_LOGGING: 'M3 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0M12 4v5',
  // Street light — lamp on a post.
  BROKEN_STREET_LIGHT: 'M12 21V10M8 21h8M7 6h10l-2 4H9L7 6zM12 6V3',
  // Footpath — broken paving slabs.
  DAMAGED_FOOTPATH: 'M3 9h18M3 15h18M9 4v16M15 4v16',
  // Sewage — manhole cover with rising arrows.
  SEWAGE_OVERFLOW: 'M4 18h16M8 18a4 4 0 0 1 8 0M12 12V3M9 6l3-3 3 3',
  // Other — question/unknown.
  OTHER: 'M12 17h.01M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7',
};

export default function CategoryIcon({
  category,
  className = 'size-4',
  decorative = false,
}: CategoryIconProps) {
  const path = PATHS[category ?? ''] ?? PATHS.OTHER;
  const label = categoryLabel(category);

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      // Decorative when a text label sits beside it: announcing the category
      // twice is worse than not announcing it at all.
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
    >
      <path d={path} />
    </svg>
  );
}
