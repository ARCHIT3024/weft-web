import type { Issue } from '../types/issue';

/**
 * SLA state for an issue, derived on the client.
 *
 * **This is a derivation, not a fetched value, and that is a limitation worth
 * knowing.** The real threshold lives in `departments.sla_hours` (per department,
 * seeded 24–120h by migration 014) and no endpoint exposes it yet — there is no
 * `GET /departments`. So the client applies the PRD's stated default of 72 hours
 * uniformly and says so wherever a breach is shown.
 *
 * The consequence: a Sanitation issue (real SLA 24h) will not be flagged until
 * 72h. The indicator therefore **under-reports** breaches rather than inventing
 * them, which is the right direction for a number a supervisor may act on — but
 * it is not the truth, and the UI must not imply it is.
 *
 * Replace `DEFAULT_SLA_HOURS` with the department's real value as soon as an
 * endpoint carries it; the call sites need no change.
 */

/** PRD §US-009: "default: 72 hours for P1 issues". */
export const DEFAULT_SLA_HOURS = 72;

/** Statuses where the SLA clock has stopped. */
const TERMINAL = new Set(['RESOLVED', 'REJECTED']);

export type SlaState = 'ok' | 'at-risk' | 'breached' | 'closed' | 'unknown';

export interface Sla {
  state: SlaState;
  /** Hours elapsed since the report was filed. */
  ageHours: number;
  /** Fraction of the SLA window consumed, 0–1+ (undefined when closed). */
  consumed: number | null;
  /** Short human phrase, e.g. "18h over" or "12h left". */
  label: string;
}

/**
 * "At risk" starts at 70% of the window — the SLA_RISK_THRESHOLD_PERCENT the
 * AI-layer spec already uses, reused here so the two do not drift.
 */
const AT_RISK_FRACTION = 0.7;

export const slaFor = (issue: Issue, now: number = Date.now()): Sla => {
  if (issue.created_at === null) {
    return { state: 'unknown', ageHours: 0, consumed: null, label: '—' };
  }

  const created = Date.parse(issue.created_at);
  if (Number.isNaN(created)) {
    return { state: 'unknown', ageHours: 0, consumed: null, label: '—' };
  }

  const ageHours = (now - created) / 36e5;

  if (TERMINAL.has(issue.status ?? '')) {
    // Closed issues are not "on time" or "late" any more — they are done. A
    // resolved issue still showing a red breach badge trains people to ignore
    // the badge.
    return { state: 'closed', ageHours, consumed: null, label: 'Closed' };
  }

  const consumed = ageHours / DEFAULT_SLA_HOURS;
  const remaining = DEFAULT_SLA_HOURS - ageHours;

  if (consumed >= 1) {
    return {
      state: 'breached',
      ageHours,
      consumed,
      label: `${Math.floor(ageHours - DEFAULT_SLA_HOURS)}h over`,
    };
  }
  if (consumed >= AT_RISK_FRACTION) {
    return { state: 'at-risk', ageHours, consumed, label: `${Math.ceil(remaining)}h left` };
  }
  return { state: 'ok', ageHours, consumed, label: `${Math.ceil(remaining)}h left` };
};

/** Breached first, then at-risk, then by age — the order a supervisor triages in. */
export const bySlaUrgency = (a: Issue, b: Issue, now: number = Date.now()): number => {
  const rank: Record<SlaState, number> = {
    breached: 0,
    'at-risk': 1,
    ok: 2,
    unknown: 3,
    closed: 4,
  };
  const sa = slaFor(a, now);
  const sb = slaFor(b, now);
  if (rank[sa.state] !== rank[sb.state]) return rank[sa.state] - rank[sb.state];
  return sb.ageHours - sa.ageHours;
};
