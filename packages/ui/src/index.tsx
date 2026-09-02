/**
 * Shared UI primitives.
 *
 * The trust badges are the important ones. They are the mechanism by which the
 * distinctions in the data model — first-party vs independent, announced vs deployed,
 * fact vs interpretation — become visible to a reader who is skimming. Getting the
 * label wrong here would undo the whole evidence model, so each one maps 1:1 to an
 * enum value and none of them is decorative.
 */

import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import {
  type CaseMaturity,
  type ClaimType,
  type EvidenceStrength,
  type Generator,
  type IntegrationStatus,
  type NoveltyKind,
  type SourcePerspective,
  type VerificationStatus,
  isFirstParty,
} from '@mios/domain';

type Tone = 'neutral' | 'accent' | 'verified' | 'caution' | 'alert' | 'muted';

/*
 * Hairline outlines rather than filled pills.
 *
 * Fills made every badge a small coloured box, and with six of them on a card the page
 * became a field of blocks. The rule carries the same information with far less weight,
 * and uppercase with wide tracking makes them read as labels rather than as buttons.
 */
const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-transparent text-[var(--text-muted)] border-[var(--border-strong)]',
  accent: 'bg-transparent text-[var(--text)] border-[var(--accent-line)]',
  verified: 'bg-transparent text-verified-700 border-verified-500/35 dark:text-verified-100',
  caution: 'bg-transparent text-caution-700 border-caution-500/35 dark:text-caution-100',
  alert: 'bg-transparent text-alert-700 border-alert-500/40 dark:text-alert-100',
  muted: 'bg-transparent text-[var(--text-subtle)] border-[var(--border)]',
};

export function Badge({
  children,
  tone = 'neutral',
  title,
  className = '',
}: {
  children: ReactNode;
  tone?: Tone;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-4 tracking-[0.055em] whitespace-nowrap ${TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

// ── Trust badges ─────────────────────────────────────────────────────────────

const PERSPECTIVE_LABEL: Record<SourcePerspective, string> = {
  FIRST_PARTY_COMPANY: 'Company itself',
  FIRST_PARTY_TECH_PROVIDER: 'Vendor itself',
  FIRST_PARTY_CONSULTING_FIRM: 'Consulting firm itself',
  FIRST_PARTY_CLIENT: 'Client itself',
  INDEPENDENT_BUSINESS_MEDIA: 'Independent media',
  INDUSTRY_MEDIA: 'Trade press',
  REGULATOR: 'Regulator',
  PUBLIC_INSTITUTION: 'Public institution',
  RESEARCH_INSTITUTION: 'Research institution',
  ACADEMIC_SOURCE: 'Academic',
  LICENSED_PREMIUM: 'Licensed source',
  AUTHORIZED_INTERNAL: 'Internal source',
  USER_PROVIDED: 'User-provided',
};

export function PerspectiveBadge({ perspective }: { perspective: SourcePerspective }) {
  const firstParty = isFirstParty(perspective);
  return (
    <Badge
      tone={firstParty ? 'caution' : 'neutral'}
      title={
        firstParty
          ? 'Self-reported. The subject of the story is also the source of it — useful, but not independent confirmation.'
          : 'Reported by a party other than the subject.'
      }
    >
      {firstParty ? '◑' : '○'} {PERSPECTIVE_LABEL[perspective]}
    </Badge>
  );
}

const EVIDENCE_LABEL: Record<EvidenceStrength, { text: string; tone: Tone; hint: string }> = {
  QUANTIFIED_PRIMARY_EVIDENCE: {
    text: 'Quantified primary evidence',
    tone: 'verified',
    hint: 'A primary source states a measurable figure.',
  },
  UNQUANTIFIED_PRIMARY_EVIDENCE: {
    text: 'Primary evidence',
    tone: 'verified',
    hint: 'A primary source, but without a measurable figure.',
  },
  MULTIPLE_CREDIBLE_SECONDARY_SOURCES: {
    text: 'Multiple independent sources',
    tone: 'verified',
    hint: 'Reported independently by more than one credible outlet.',
  },
  SINGLE_CREDIBLE_SECONDARY_SOURCE: {
    text: 'One independent source',
    tone: 'neutral',
    hint: 'One credible outlet, no corroboration yet.',
  },
  COMPANY_SELF_REPORTING: {
    text: 'Company self-reporting',
    tone: 'caution',
    hint: 'The company is describing itself. Precision is not independence.',
  },
  WEAK_OR_UNVERIFIED_SIGNAL: {
    text: 'Weak signal',
    tone: 'alert',
    hint: 'Insufficient basis to treat this as established.',
  },
};

export function EvidenceBadge({ strength }: { strength: EvidenceStrength }) {
  const meta = EVIDENCE_LABEL[strength];
  return (
    <Badge tone={meta.tone} title={meta.hint}>
      {meta.text}
    </Badge>
  );
}

const MATURITY_LABEL: Record<CaseMaturity, { text: string; tone: Tone; hint: string }> = {
  ANNOUNCED: { text: 'Announced', tone: 'caution', hint: 'Stated intent. No implementation scope given.' },
  CONCEPT: { text: 'Concept', tone: 'caution', hint: 'Being explored; nothing built.' },
  PILOT: { text: 'Pilot', tone: 'neutral', hint: 'Bounded trial. Most pilots do not scale.' },
  LIMITED_DEPLOYMENT: { text: 'Limited deployment', tone: 'neutral', hint: 'Live in selected locations or units.' },
  SCALED_DEPLOYMENT: { text: 'Scaled', tone: 'accent', hint: 'Described as deployed across the organisation.' },
  QUANTIFIED_BUSINESS_IMPACT: {
    text: 'Quantified impact',
    tone: 'accent',
    hint: 'A measured outcome is claimed — check who is claiming it.',
  },
  INDEPENDENTLY_VALIDATED_IMPACT: {
    text: 'Independently validated',
    tone: 'verified',
    hint: 'A party other than the beneficiary reports the same outcome.',
  },
  DISCONTINUED_OR_REVERSED: {
    text: 'Discontinued',
    tone: 'alert',
    hint: 'Stopped or reversed. Usually more informative than the original announcement.',
  },
};

export function MaturityBadge({ maturity }: { maturity: CaseMaturity }) {
  const meta = MATURITY_LABEL[maturity];
  return (
    <Badge tone={meta.tone} title={meta.hint}>
      {meta.text}
    </Badge>
  );
}

const VERIFICATION_LABEL: Record<VerificationStatus, { text: string; tone: Tone }> = {
  SINGLE_SOURCE: { text: 'Single source', tone: 'neutral' },
  CORROBORATED: { text: 'Corroborated', tone: 'verified' },
  PRIMARY_SOURCE_CONFIRMED: { text: 'Primary source confirmed', tone: 'verified' },
  DISPUTED: { text: 'Sources disagree', tone: 'alert' },
  CORRECTED: { text: 'Corrected', tone: 'caution' },
  RETRACTED: { text: 'Retracted', tone: 'alert' },
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const meta = VERIFICATION_LABEL[status];
  return <Badge tone={meta.tone}>{meta.text}</Badge>;
}

const CLAIM_TYPE_LABEL: Record<ClaimType, { text: string; tone: Tone; hint: string }> = {
  FACT: { text: 'Fact', tone: 'verified', hint: 'Stated in the source and backed by an evidence span.' },
  INTERPRETATION: { text: 'Interpretation', tone: 'caution', hint: 'A reading of the facts, not a fact.' },
  HYPOTHESIS: { text: 'Hypothesis', tone: 'caution', hint: 'A testable proposition we are putting forward.' },
  FORECAST: { text: 'Forecast', tone: 'caution', hint: 'A claim about the future, stated by the source.' },
  UNVERIFIED_SIGNAL: { text: 'Unverified', tone: 'alert', hint: 'Noted, but not established.' },
};

export function ClaimTypeBadge({ type }: { type: ClaimType }) {
  const meta = CLAIM_TYPE_LABEL[type];
  return (
    <Badge tone={meta.tone} title={meta.hint}>
      {meta.text}
    </Badge>
  );
}

export function DemoBadge() {
  return (
    <Badge tone="alert" title="Illustrative fixture data written for this repository. Not real reporting.">
      Demo data
    </Badge>
  );
}

const NOVELTY_LABEL: Record<NoveltyKind, string> = {
  new_to_world: 'New',
  new_to_user: 'New to you',
  updated_event: 'Updated',
  repeated_announcement: 'Restated',
  foundational: 'Foundational',
};

export function NoveltyBadge({ novelty }: { novelty: NoveltyKind }) {
  return (
    <Badge
      tone={novelty === 'repeated_announcement' ? 'muted' : 'accent'}
      title={
        novelty === 'repeated_announcement'
          ? 'This restates something already communicated. Nothing here is new.'
          : undefined
      }
    >
      {NOVELTY_LABEL[novelty]}
    </Badge>
  );
}

export function GeneratorBadge({ generator }: { generator: Generator }) {
  if (generator === 'llm') {
    return (
      <Badge tone="neutral" title="Model-generated, then schema-validated and checked against stored evidence.">
        Model-assisted
      </Badge>
    );
  }
  if (generator === 'human_curated') return <Badge tone="verified">Curated</Badge>;
  if (generator === 'seed_demo') return <DemoBadge />;
  return (
    <Badge
      tone="muted"
      title="No language model is configured. Text here reuses sentences exactly as they appear in the sources; structure and classifications come from rules."
    >
      Extractive
    </Badge>
  );
}

const STATUS_LABEL: Record<IntegrationStatus, { text: string; tone: Tone }> = {
  live: { text: 'Live', tone: 'verified' },
  fallback_active: { text: 'Fallback active', tone: 'caution' },
  not_configured: { text: 'Not configured', tone: 'muted' },
  blocked_by_rights: { text: 'Blocked: rights review', tone: 'alert' },
  blocked_by_credentials: { text: 'Blocked: no credentials', tone: 'alert' },
  disabled: { text: 'Disabled', tone: 'muted' },
  demo_only: { text: 'Demo only', tone: 'caution' },
};

export function StatusBadge({ status }: { status: IntegrationStatus }) {
  const meta = STATUS_LABEL[status];
  return <Badge tone={meta.tone}>{meta.text}</Badge>;
}

// ── Layout primitives ────────────────────────────────────────────────────────

export function SectionHeading({
  children,
  hint,
  action,
}: {
  children: ReactNode;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.07em] text-[var(--text-subtle)]">
          {children}
        </h2>
        {hint ? <p className="mt-0.5 text-[13px] text-[var(--text-subtle)]">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

type CardTag = 'div' | 'article' | 'section' | 'li';

/**
 * Forwards arbitrary props so callers can set `data-evidence` — which colours the left
 * edge by evidence strength — and a staggered `animationDelay`, without this component
 * needing to know about either.
 */
export function Card({
  children,
  className = '',
  as: Tag = 'div',
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: CardTag;
} & Omit<ComponentPropsWithoutRef<CardTag>, 'children' | 'className'>) {
  // TypeScript cannot prove that props valid for one member of the tag union are valid
  // for the element actually chosen, so the spread needs a widening cast. The public
  // signature above is still exact — this is only about the internal handoff.
  const Element = Tag as ElementType;
  return (
    <Element className={`surface p-4 ${className}`} {...rest}>
      {children}
    </Element>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface flex flex-col items-start gap-2 p-6">
      <p className="text-[15px] font-medium">{title}</p>
      <p className="max-w-prose text-[14px] leading-relaxed text-[var(--text-muted)]">{body}</p>
      {action}
    </div>
  );
}

/**
 * Labels an interpretation so a reader skimming cannot mistake it for something a
 * source said. Used everywhere the platform reasons rather than reports.
 */
export function InterpretationBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="label-interpretation">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-caution-700 dark:text-caution-100">
        {label} · our interpretation
      </p>
      <div className="text-[14px] leading-relaxed text-[var(--text-muted)]">{children}</div>
    </div>
  );
}

export function KnownUnknowns({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="surface-flat rounded-md bg-[var(--surface-sunken)] p-3">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-subtle)]">
        What this does not tell you
      </p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-[var(--text-muted)]">
            <span aria-hidden className="text-[var(--text-subtle)]">
              ·
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
