'use client';

import { useState } from 'react';
import type { CurrentPreferences, PreferenceOptions } from '@/lib/preferences';

/**
 * The one form behind both onboarding and preference editing.
 *
 * Shared deliberately: a first-run wizard that diverges from the settings screen is how
 * you end up with fields you can set once and never change, which is exactly the state
 * this product was in.
 *
 * Every choice here is optional. The brief works without any of them — it just works
 * generically — so nothing is marked required and the submit button never blocks. What
 * the copy does instead is say what each answer actually changes, because "select your
 * interests" tells you nothing about why you should bother.
 */

const MINUTES = [5, 8, 12, 20, 30];

const DEPTHS = [
  { value: 'foundation', label: 'Foundation', hint: 'Explain the basics as we go' },
  { value: 'executive', label: 'Executive', hint: 'Assume I know the industry' },
  { value: 'expert', label: 'Expert', hint: 'Skip the context, give me the detail' },
] as const;

export function PreferenceForm({
  options,
  current,
  action,
  submitLabel,
}: {
  options: PreferenceOptions;
  current: CurrentPreferences;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
}) {
  const [entityQuery, setEntityQuery] = useState('');
  const [entities, setEntities] = useState<string[]>(current.entitySlugs);

  const matchingEntities = entityQuery.trim()
    ? options.entities.filter((e) =>
        e.name.toLowerCase().includes(entityQuery.trim().toLowerCase()),
      )
    : options.entities.slice(0, 12);

  const toggleEntity = (slug: string) =>
    setEntities((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));

  return (
    <form action={action} className="space-y-10">
      <Section
        n="01"
        title="What do you do?"
        why="Sets the register of every answer — a partner and an analyst want different things from the same fact."
      >
        <input
          name="role"
          defaultValue={current.role}
          placeholder="Management consultant, retail strategy"
          className="w-full max-w-md rounded border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[13.5px] outline-none focus:border-[var(--accent)]"
        />
      </Section>

      <Section
        n="02"
        title="Which industries?"
        why="Your brief leads with these. One slot is always kept for something outside them, so this narrows without sealing you in."
      >
        <CheckGroup name="industries" options={options.industries} selected={current.industrySlugs} />
      </Section>

      <Section
        n="03"
        title="Which topics?"
        why="Cuts across industries. These keep working when a sector has thin coverage — regulation and pricing apply to a tobacco client as readily as to a retailer."
      >
        <CheckGroup name="topics" options={options.topics} selected={current.topicSlugs} />
      </Section>

      {options.technologies.length > 0 ? (
        <Section
          n="04"
          title="Which technologies?"
          why="Optional. Useful if you follow a specific capability rather than a sector."
        >
          <CheckGroup
            name="technologies"
            options={options.technologies}
            selected={current.technologySlugs}
          />
        </Section>
      ) : null}

      <Section
        n={options.technologies.length > 0 ? '05' : '04'}
        title="Which companies and clients?"
        why="Drives My client, and the 'quiet on your watchlist' band on Watch — where silence about a company you follow is reported as a gap in our monitoring rather than hidden."
      >
        <input
          value={entityQuery}
          onChange={(e) => setEntityQuery(e.target.value)}
          placeholder="Type a company name…"
          className="w-full max-w-md rounded border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[13.5px] outline-none focus:border-[var(--accent)]"
        />

        {entities.map((slug) => (
          <input key={slug} type="hidden" name="entities" value={slug} />
        ))}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {matchingEntities.map((e) => {
            const on = entities.includes(e.slug);
            return (
              <button
                key={e.slug}
                type="button"
                onClick={() => toggleEntity(e.slug)}
                aria-pressed={on}
                className={`rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
                  on
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--surface)]'
                    : 'border-[var(--border-strong)] text-[var(--text-muted)] hover:border-[var(--accent-line)]'
                }`}
              >
                {e.name}
              </button>
            );
          })}
          {matchingEntities.length === 0 ? (
            <p className="text-[12.5px] text-[var(--text-subtle)]">
              No tracked company matches “{entityQuery}”. You can still add it later — the
              coverage check will tell you what it would take to start monitoring them.
            </p>
          ) : null}
        </div>

        {entities.length > 0 ? (
          <p className="mt-3 text-[11.5px] text-[var(--text-subtle)]">
            {entities.length} selected. Selecting a company we do not yet cover is fine — the
            product will say so rather than pretend nothing is happening.
          </p>
        ) : null}
      </Section>

      <Section
        n={options.technologies.length > 0 ? '06' : '05'}
        title="How long should the daily brief be?"
        why="A hard budget, not a suggestion. The brief ends when you reach the bottom — that is the whole point of it being finite."
      >
        <div className="flex flex-wrap gap-1.5">
          {MINUTES.map((m) => (
            <label key={m} className="cursor-pointer">
              <input
                type="radio"
                name="dailyReadingMinutes"
                value={m}
                defaultChecked={current.dailyReadingMinutes === m}
                className="peer sr-only"
              />
              <span className="inline-block rounded-md border border-[var(--border-strong)] px-3 py-1.5 text-[12.5px] text-[var(--text-muted)] transition-colors peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent)] peer-checked:text-[var(--surface)]">
                {m} min
              </span>
            </label>
          ))}
        </div>
      </Section>

      <Section
        n={options.technologies.length > 0 ? '07' : '06'}
        title="How much should we explain?"
        why="Changes the depth of every answer the Companion gives and every learning unit it suggests."
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {DEPTHS.map((d) => (
            <label key={d.value} className="cursor-pointer">
              <input
                type="radio"
                name="preferredDepth"
                value={d.value}
                defaultChecked={current.preferredDepth === d.value}
                className="peer sr-only"
              />
              <span className="block rounded-md border border-[var(--border-strong)] p-3 transition-colors peer-checked:border-[var(--accent)]">
                <span className="block text-[13px] font-medium">{d.label}</span>
                <span className="mt-1 block text-[11.5px] leading-relaxed text-[var(--text-subtle)]">
                  {d.hint}
                </span>
              </span>
            </label>
          ))}
        </div>
      </Section>

      <div className="flex flex-wrap items-center gap-4 border-t border-[var(--border)] pt-6">
        <button
          type="submit"
          className="rounded bg-[var(--accent)] px-5 py-2.5 text-[13.5px] font-medium text-[var(--surface)]"
        >
          {submitLabel}
        </button>
        <p className="text-[11.5px] leading-relaxed text-[var(--text-subtle)]">
          All of it is optional and all of it is changeable later. Leaving everything blank
          gives you a general brief rather than a broken one.
        </p>
      </div>
    </form>
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
    <section>
      <div className="flex items-baseline gap-3">
        <span className="row-index">{n}</span>
        <h2 className="text-[17px] font-medium tracking-[-0.01em]">{title}</h2>
      </div>
      <p className="mb-4 mt-1.5 max-w-[68ch] pl-[calc(0.75rem+2ch)] text-[12.5px] leading-relaxed text-[var(--text-subtle)]">
        {why}
      </p>
      <div className="pl-[calc(0.75rem+2ch)]">{children}</div>
    </section>
  );
}

function CheckGroup({
  name,
  options,
  selected,
}: {
  name: string;
  options: { slug: string; name: string }[];
  selected: string[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <label key={o.slug} className="cursor-pointer">
          <input
            type="checkbox"
            name={name}
            value={o.slug}
            defaultChecked={selected.includes(o.slug)}
            className="peer sr-only"
          />
          <span className="inline-block rounded-md border border-[var(--border-strong)] px-2.5 py-1 text-[12px] text-[var(--text-muted)] transition-colors peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent)] peer-checked:text-[var(--surface)]">
            {o.name}
          </span>
        </label>
      ))}
    </div>
  );
}
