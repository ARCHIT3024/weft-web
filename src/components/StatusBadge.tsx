import { statusMeta } from '../lib/issueMeta';

interface StatusBadgeProps {
  status: string | null;
  /** `sm` for table cells, `md` for detail headers. */
  size?: 'sm' | 'md';
}

/**
 * The one place an issue status is rendered.
 *
 * Carries a shape glyph as well as a colour, and always the text label, so the
 * four states stay distinguishable without colour vision (WCAG 2.1 §1.4.1).
 * The glyph is `aria-hidden` — it is a redundant *visual* cue, and a screen
 * reader announcing "black diamond suit Reported" would be worse than useless.
 */
export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const meta = statusMeta(status);
  const sizing = size === 'sm' ? 'text-xs px-2 py-0.5 gap-1' : 'text-sm px-2.5 py-1 gap-1.5';

  return (
    <span
      className={`inline-flex items-center rounded-badge border font-medium whitespace-nowrap ${meta.badgeClass} ${sizing}`}
      title={meta.description}
    >
      <span aria-hidden="true">{meta.glyph}</span>
      {meta.label}
    </span>
  );
}
