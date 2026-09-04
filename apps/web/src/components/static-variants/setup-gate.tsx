'use client';

import { assetPath } from '@/lib/asset-path';
import { useEffect, useState } from 'react';
import {
  readPreferences,
  writePreferences,
  hasCompletedSetup,
  type LocalPreferences,
} from '@/lib/local-preferences';
import { Wordmark, CompassMark } from '@/components/wordmark';
import { MakersMark } from '@/components/makers-mark';

/**
 * First-run set-up, without a server.
 *
 * Appears over the app on a browser that has not been here before, writes to that
 * browser's storage, and never appears again. Each colleague opening the same URL gets
 * their own answers — which is better than the hosted open-access build, where everyone
 * shares a profile and the last person through overwrites the previous one.
 *
 * Every question is optional and skipping is a supported answer: a general brief is a
 * perfectly reasonable thing to want.
 *
 * It opens on the landing page rather than going straight to questions. On the hosted
 * build that page is a real route people arrive at; here everyone lands directly inside
 * the app, so without this the mark, the name and the three lines would never be seen by
 * the people the site was built to be shown to.
 */

const MINUTES = [5, 8, 12, 20, 30];

const DEPTHS = [
  { value: 'foundation', label: 'Foundation', hint: 'Explain the basics as we go' },
  { value: 'executive', label: 'Executive', hint: 'Assume I know the industry' },
  { value: 'expert', label: 'Expert', hint: 'Skip the context, give me the detail' },
] as const;

interface Option {
  slug: string;
  name: string;
}

export function SetupGate() {
  const [needed, setNeeded] = useState(false);
  const [step, setStep] = useState<'landing' | 'questions'>('landing');
  const [options, setOptions] = useState<{
    industries: Option[];
    topics: Option[];
    entities: Option[];
  } | null>(null);
  const [prefs, setPrefs] = useState<LocalPreferences>(readPreferences());
  const [companyQuery, setCompanyQuery] = useState('');

  useEffect(() => {
    if (hasCompletedSetup()) return;
    setNeeded(true);
    void fetch(assetPath('/palette.json'))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setOptions({
          industries: data.industries ?? [],
          topics: data.topics ?? [],
          entities: data.entities ?? [],
        });
      })
      .catch(() => setOptions({ industries: [], topics: [], entities: [] }));
  }, []);

  if (!needed) return null;

  if (step === 'landing') {
    return (
      <div className="fixed inset-0 z-[95] flex flex-col overflow-y-auto bg-[var(--surface)] px-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-[var(--border)] opacity-60"
        />

        <header className="relative z-10 flex items-center justify-between py-7">
          <CompassMark size={22} className="text-[var(--text)]" />
          <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-[var(--text-subtle)]">
            Market intelligence
          </p>
        </header>

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center py-16 text-center">
          <CompassMark size={104} className="mb-12 text-[var(--text)]" />
          <Wordmark size="xl" />

          <div className="mt-14 max-w-[46ch] space-y-1.5">
            {['Know what changed.', 'Understand what matters.', 'Be ready for what’s next.'].map(
              (line, i) => (
                <p
                  key={line}
                  className={`text-[15px] leading-relaxed sm:text-[17px] ${
                    i === 0 ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {line}
                </p>
              ),
            )}
          </div>

          <button
            type="button"
            onClick={() => setStep('questions')}
            className="group mt-16 inline-flex items-center gap-3 border border-[var(--border-strong)] px-8 py-3.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text)] transition-colors hover:border-[var(--text)]"
          >
            Activate NORTH
            <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </button>
        </div>

        <footer className="relative z-10 flex flex-wrap items-baseline justify-between gap-3 py-7">
          {/* The monogram is a button. See MakersMark. */}
          <span className="inline-flex items-baseline gap-1.5">
            <Wordmark size="sm" monogram={false} />
            <MakersMark className="text-[7px] font-semibold leading-none" />
          </span>
          <p className="max-w-[52ch] text-[10.5px] leading-relaxed text-[var(--text-subtle)]">
            Every fact carries the passage it came from. Where the evidence is not there,
            NORTH says so rather than filling the gap.
          </p>
        </footer>
      </div>
    );
  }

  const toggle = (key: 'industries' | 'topics' | 'companies', slug: string) =>
    setPrefs((p) => ({
      ...p,
      [key]: p[key].includes(slug) ? p[key].filter((s) => s !== slug) : [...p[key], slug],
    }));

  const finish = (saveChoices: boolean) => {
    writePreferences(saveChoices ? prefs : {});
    setNeeded(false);
  };

  const companyMatches = companyQuery.trim()
    ? (options?.entities ?? [])
        .filter((e) => e.name.toLowerCase().includes(companyQuery.trim().toLowerCase()))
        .slice(0, 8)
    : [];

  return (
    <div className="fixed inset-0 z-[95] overflow-y-auto bg-[var(--surface)]">
      <div className="mx-auto max-w-[720px] px-6 py-12">
        <p className="t-eyebrow">Set up</p>
        <h1 className="mt-2 text-[27px] font-semibold leading-[1.16] tracking-[-0.028em]">
          What should NORTH be about, for you?
        </h1>
        <p className="mt-3 max-w-[62ch] text-[14px] leading-[1.68] text-[var(--text-muted)]">
          All optional, all changeable. What you pick becomes the filters you start from.
        </p>
        <p className="mt-3 max-w-[62ch] border-l border-[var(--border-strong)] pl-3.5 text-[12px] leading-relaxed text-[var(--text-subtle)]">
          This is a snapshot with no accounts, so your answers are kept in this browser and
          belong to you alone. The daily brief itself was assembled when the site was built
          and does not re-rank — these shape what you filter and where the saved views point.
        </p>

        <Section n="01" title="Which industries?" why="Your saved views start here.">
          <Chips
            options={options?.industries ?? []}
            selected={prefs.industries}
            onToggle={(slug) => toggle('industries', slug)}
          />
        </Section>

        <Section
          n="02"
          title="Which topics?"
          why="These cut across sectors, so they keep working where an industry has thin coverage."
        >
          <Chips
            options={options?.topics ?? []}
            selected={prefs.topics}
            onToggle={(slug) => toggle('topics', slug)}
          />
        </Section>

        <Section n="03" title="Which companies?" why="Type a name. Anything tracked can be picked.">
          <input
            value={companyQuery}
            onChange={(e) => setCompanyQuery(e.target.value)}
            placeholder="Search a company…"
            className="w-full max-w-md rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[13.5px] outline-none focus:border-[var(--accent)]"
          />
          {companyMatches.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {companyMatches.map((c) => (
                <Chip
                  key={c.slug}
                  label={c.name}
                  on={prefs.companies.includes(c.slug)}
                  onClick={() => toggle('companies', c.slug)}
                />
              ))}
            </div>
          ) : null}
          {prefs.companies.length > 0 ? (
            <p className="mt-2 text-[11.5px] text-[var(--text-subtle)]">
              {prefs.companies.length} selected.
            </p>
          ) : null}
        </Section>

        <Section n="04" title="How long should the brief be?" why="A budget, not a suggestion.">
          <div className="flex flex-wrap gap-1.5">
            {MINUTES.map((m) => (
              <Chip
                key={m}
                label={`${m} min`}
                on={prefs.dailyReadingMinutes === m}
                onClick={() => setPrefs((p) => ({ ...p, dailyReadingMinutes: m }))}
              />
            ))}
          </div>
        </Section>

        <Section n="05" title="How much should we explain?" why="Sets the register of what you read.">
          <div className="grid gap-2 sm:grid-cols-3">
            {DEPTHS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, preferredDepth: d.value }))}
                className={`rounded-md border p-3 text-left transition-colors ${
                  prefs.preferredDepth === d.value
                    ? 'border-[var(--accent)]'
                    : 'border-[var(--border-strong)]'
                }`}
              >
                <span className="block text-[13px] font-medium">{d.label}</span>
                <span className="mt-1 block text-[11.5px] leading-relaxed text-[var(--text-subtle)]">
                  {d.hint}
                </span>
              </button>
            ))}
          </div>
        </Section>

        <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-[var(--border)] pt-6">
          <button
            type="button"
            onClick={() => finish(true)}
            className="rounded bg-[var(--accent)] px-5 py-2.5 text-[13.5px] font-medium text-[var(--surface)]"
          >
            Start reading
          </button>
          <button
            type="button"
            onClick={() => finish(false)}
            className="text-[12.5px] text-[var(--text-subtle)] underline underline-offset-2 hover:text-[var(--text)]"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  n,
  title,
  why,
  children,
}: {
  n: string;
  title: string;
  why: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9">
      <div className="flex items-baseline gap-3">
        <span className="row-index">{n}</span>
        <h2 className="text-[16px] font-medium tracking-[-0.01em]">{title}</h2>
      </div>
      <p className="mb-3 mt-1.5 pl-[calc(0.75rem+2ch)] text-[12.5px] leading-relaxed text-[var(--text-subtle)]">
        {why}
      </p>
      <div className="pl-[calc(0.75rem+2ch)]">{children}</div>
    </section>
  );
}

function Chips({
  options,
  selected,
  onToggle,
}: {
  options: Option[];
  selected: string[];
  onToggle: (slug: string) => void;
}) {
  if (options.length === 0) {
    return <p className="text-[12.5px] text-[var(--text-subtle)]">Loading…</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <Chip
          key={o.slug}
          label={o.name}
          on={selected.includes(o.slug)}
          onClick={() => onToggle(o.slug)}
        />
      ))}
    </div>
  );
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
        on
          ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--surface)]'
          : 'border-[var(--border-strong)] text-[var(--text-muted)] hover:border-[var(--accent-line)]'
      }`}
    >
      {label}
    </button>
  );
}
