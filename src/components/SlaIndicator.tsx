import { DEFAULT_SLA_HOURS, slaFor, type Sla } from '../lib/sla';
import type { Issue } from '../types/issue';

/**
 * SLA state as colour + glyph + text — never colour alone.
 *
 * The spec asks for "SLA breach rows flagged in red with AlertTriangle icon —
 * immediately actionable". The glyph differs per state so the three are
 * distinguishable in greyscale and to a colour-blind user, and the title
 * attribute states the assumed threshold, because the number is derived rather
 * than fetched (see `lib/sla.ts`).
 */

const STYLES: Record<Sla['state'], { cls: string; glyph: string; text: string }> = {
  breached: {
    cls: 'bg-danger/12 text-danger-dark border-danger/40',
    glyph: '▲',
    text: 'Breached',
  },
  'at-risk': {
    cls: 'bg-orange/12 text-orange-dark border-orange/40',
    glyph: '◗',
    text: 'At risk',
  },
  ok: { cls: 'bg-surface-secondary text-text-secondary border-border', glyph: '·', text: 'On time' },
  closed: {
    cls: 'bg-surface-secondary text-text-muted border-border',
    glyph: '✓',
    text: 'Closed',
  },
  unknown: { cls: 'bg-surface-secondary text-text-muted border-border', glyph: '?', text: '—' },
};

interface SlaIndicatorProps {
  issue: Issue;
  /** `full` shows the remaining/over time; `dot` is the compact table variant. */
  variant?: 'full' | 'dot';
}

export default function SlaIndicator({ issue, variant = 'full' }: SlaIndicatorProps) {
  const sla = slaFor(issue);
  const style = STYLES[sla.state];

  const title =
    sla.state === 'closed' || sla.state === 'unknown'
      ? style.text
      : `${style.text} — ${sla.label}. Assumes a ${DEFAULT_SLA_HOURS}h target; per-department SLA is not yet exposed by the API.`;

  if (variant === 'dot') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-badge border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${style.cls}`}
        title={title}
      >
        <span aria-hidden="true">{style.glyph}</span>
        <span className="sr-only">SLA: </span>
        {style.text}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-badge border px-2 py-1 text-sm font-medium whitespace-nowrap ${style.cls}`}
      title={title}
    >
      <span aria-hidden="true">{style.glyph}</span>
      <span className="sr-only">SLA: </span>
      {style.text}
      {sla.state !== 'closed' && sla.state !== 'unknown' && (
        <span className="tabular font-normal opacity-80">· {sla.label}</span>
      )}
    </span>
  );
}
