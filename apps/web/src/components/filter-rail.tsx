'use client';

import { useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@mios/ui';
import type { ExploreFacets, Facet } from '@/lib/explore-queries';

/**
 * The filter rail.
 *
 * State lives in the URL, so a filtered view is shareable and survives a reload, and
 * the server does the filtering. Every control is a link-shaped mutation of the query
 * string rather than local state.
 *
 * On narrow screens the rail collapses behind a toggle that shows the active count —
 * the first version hid it below the results, where nobody found it.
 */

interface Props {
  facets: ExploreFacets;
  activeCount: number;
}

type Dimension = {
  key: string;
  label: string;
  facets: Facet[];
  kind: 'chips' | 'select';
  hint?: string;
};

export function FilterRail({ facets, activeCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const [key, value] of params.entries()) {
      map.set(key, new Set(value.split(',').filter(Boolean)));
    }
    return map;
  }, [params]);

  const isOn = (key: string, value: string) => selected.get(key)?.has(value) ?? false;

  const apply = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  /** Multi-select within a dimension: values OR together. */
  const toggleValue = (key: string, value: string) =>
    apply((next) => {
      const current = new Set((next.get(key) ?? '').split(',').filter(Boolean));
      if (current.has(value)) current.delete(value);
      else current.add(value);
      if (current.size === 0) next.delete(key);
      else next.set(key, [...current].join(','));
    });

  const setSingle = (key: string, value: string) =>
    apply((next) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });

  const toggleFlag = (key: string) =>
    apply((next) => {
      if (next.get(key)) next.delete(key);
      else next.set(key, '1');
    });

  const clearAll = () => start(() => router.replace(pathname, { scroll: false }));

  const dimensions: Dimension[] = [
    { key: 'industry', label: 'Industry', facets: facets.industries, kind: 'chips' },
    { key: 'company', label: 'Company', facets: facets.companies, kind: 'select' },
    { key: 'topic', label: 'Topic', facets: facets.topics, kind: 'chips' },
    { key: 'technology', label: 'Technology', facets: facets.technologies, kind: 'chips' },
    { key: 'eventType', label: 'Event type', facets: facets.eventTypes, kind: 'select' },
    {
      key: 'maturity',
      label: 'Implementation maturity',
      facets: facets.maturities,
      kind: 'chips',
      hint: 'Announcement, pilot, deployed, measured — the hype filter.',
    },
    {
      key: 'evidence',
      label: 'Evidence strength',
      facets: facets.evidenceStrengths,
      kind: 'select',
      hint: 'How much weight a claim can bear.',
    },
  ];

  const fixed = {
    perspective: [
      ['OFFICIAL_COMPANY', 'Company'],
      ['TECHNOLOGY_PROVIDERS', 'Vendors'],
      ['INDEPENDENT_BUSINESS_MEDIA', 'Independent'],
      ['REGULATORS_AND_PUBLIC_INSTITUTIONS', 'Regulators'],
      ['CONSULTING_AND_PROFESSIONAL_SERVICES', 'Consulting'],
      ['RESEARCH_AND_ACADEMIA', 'Research'],
    ],
    impact: [
      ['very_high', 'Very high'],
      ['high', 'High'],
      ['moderate', 'Moderate'],
      ['low', 'Low'],
    ],
    novelty: [
      ['new_to_world', 'New'],
      ['updated_event', 'Updated'],
      ['repeated_announcement', 'Restated'],
    ],
    within: [
      ['7', '7 days'],
      ['30', '30 days'],
      ['90', '90 days'],
      ['365', '12 months'],
    ],
  } as const;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="surface mb-3 w-full px-4 py-3 text-left text-[13.5px] font-semibold lg:hidden"
      >
        Filters{' '}
        <span className="font-medium text-[var(--accent)]">
          · {activeCount > 0 ? `${activeCount} active` : 'none active'}
        </span>
      </button>

      <aside
        className={`surface self-start lg:sticky lg:top-[74px] lg:block lg:max-h-[calc(100dvh-96px)] lg:overflow-y-auto ${
          open ? 'block' : 'hidden'
        } ${pending ? 'opacity-70' : ''}`}
        aria-label="Filters"
      >
        <div className="border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="t-section">Filters</span>
            {activeCount > 0 ? (
              <button
                type="button"
                onClick={clearAll}
                className="text-[11.5px] font-medium text-[var(--accent)]"
              >
                Clear all
              </button>
            ) : null}
          </div>
          <p className="t-meta mt-1.5">
            Counts show what you would get by adding each option to the current selection.
          </p>
        </div>

        {dimensions.map((d) =>
          d.facets.length === 0 ? null : (
            <div key={d.key} className="border-b border-[var(--border)] px-4 py-3">
              <div className="t-section mb-2">{d.label}</div>
              {d.hint ? <p className="t-meta mb-2">{d.hint}</p> : null}

              {d.kind === 'chips' ? (
                <div className="flex flex-wrap gap-1.5">
                  {d.facets.map((f) => (
                    <button
                      key={f.slug}
                      type="button"
                      onClick={() => toggleValue(d.key, f.slug)}
                      aria-pressed={isOn(d.key, f.slug)}
                      className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition-all duration-150 ${
                        isOn(d.key, f.slug)
                          ? 'border-transparent bg-[var(--accent)] text-white shadow-[0_2px_8px_-2px_var(--accent)]'
                          : 'border-[var(--border-strong)] text-[var(--text-muted)] hover:-translate-y-px hover:border-[var(--accent)] hover:text-[var(--accent)]'
                      }`}
                    >
                      {f.label}
                      <span className="ml-1 text-[11px] opacity-60 tabular-nums">{f.count}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <select
                  value={[...(selected.get(d.key) ?? [])][0] ?? ''}
                  onChange={(e) => setSingle(d.key, e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px]"
                >
                  <option value="">All {d.label.toLowerCase()}</option>
                  {d.facets.map((f) => (
                    <option key={f.slug} value={f.slug}>
                      {f.label} ({f.count})
                    </option>
                  ))}
                </select>
              )}
            </div>
          ),
        )}

        {(
          [
            ['perspective', 'Source perspective', fixed.perspective, 'single'],
            ['impact', 'Strategic impact', fixed.impact, 'multi'],
            ['novelty', 'Novelty', fixed.novelty, 'multi'],
            ['within', 'Occurred within', fixed.within, 'single'],
          ] as const
        ).map(([key, label, options, mode]) => (
          <div key={key} className="border-b border-[var(--border)] px-4 py-3">
            <div className="t-section mb-2">{label}</div>
            <div className="flex flex-wrap gap-1.5">
              {options.map(([value, text]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    mode === 'multi'
                      ? toggleValue(key, value)
                      : setSingle(key, isOn(key, value) ? '' : value)
                  }
                  aria-pressed={isOn(key, value)}
                  className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition-all duration-150 ${
                    isOn(key, value)
                      ? 'border-transparent bg-[var(--accent)] text-white'
                      : 'border-[var(--border-strong)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                  }`}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="px-4 py-3">
          {(
            [
              ['independent', 'Independently reported only'],
              ['hideDemo', 'Hide demo data'],
            ] as const
          ).map(([key, label]) => {
            const on = Boolean(params.get(key));
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleFlag(key)}
                role="switch"
                aria-checked={on}
                className="flex w-full items-center justify-between gap-3 py-1.5 text-left text-[13px] text-[var(--text-muted)]"
              >
                <span>{label}</span>
                <span
                  aria-hidden
                  className={`relative h-[19px] w-[34px] shrink-0 rounded-full transition-colors ${
                    on ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]'
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-[15px] w-[15px] rounded-full bg-white shadow transition-transform duration-200 ${
                      on ? 'translate-x-[15px]' : ''
                    }`}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </aside>
    </>
  );
}

/** Removable chips for whatever is currently applied. */
export function ActiveFilterChips() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const entries = [...params.entries()].filter(([, v]) => v.length > 0);
  if (entries.length === 0) {
    return <Badge tone="muted">No filters</Badge>;
  }

  const remove = (key: string, value?: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) {
      const rest = (next.get(key) ?? '').split(',').filter((v) => v && v !== value);
      if (rest.length) next.set(key, rest.join(','));
      else next.delete(key);
    } else {
      next.delete(key);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.flatMap(([key, value]) =>
        value.split(',').map((v) => (
          <button key={`${key}-${v}`} type="button" onClick={() => remove(key, v)}>
            <Badge tone="accent">
              {key}: {v.replace(/_/g, ' ').toLowerCase()} ✕
            </Badge>
          </button>
        )),
      )}
    </div>
  );
}
