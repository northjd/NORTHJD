/**
 * Company financials from European regulatory filings.
 *
 * The companion to `build-edgar-facts.ts`, and the answer to a claim that was simply
 * wrong. The roadmap said no free, licence-clean structured financials existed for
 * European companies and named Adyen as permanently out of reach. Adyen files a full
 * ESEF annual report every year and it is downloadable, tagged, in euros, without a key.
 * The mistake was checking one source, finding it worked, and generalising.
 *
 * **ESEF** — the European Single Electronic Format — has required every issuer on an EU
 * regulated market to file its annual report as Inline XBRL since 2020. XBRL
 * International indexes those filings at filings.xbrl.org and republishes each one as
 * xBRL-JSON. Their terms: "At present, there are no restrictions on the ways that the
 * data can be used."
 *
 * It uses the same `ifrs-full` taxonomy the EDGAR script already reads for 20-F filers,
 * so `Revenue` and `ProfitLossFromOperatingActivities` mean here what they mean there.
 *
 * What this deliberately does not do, unchanged from EDGAR:
 *
 *   - **No conversion.** Filings arrive in EUR, DKK, SEK, NOK, GBP and CHF, and a rate
 *     needs a date the filing does not give.
 *   - **No estimates.** A company with no clean consolidated annual keeps an empty
 *     profile, and the page says which figures are missing and why.
 *   - **No overwriting.** Where EDGAR already produced a profile it is left alone. The
 *     two should agree, and a company's SEC filing is not improved by being replaced.
 *
 * What is still out of reach, and honestly: ESEF covers listed issuers. Aldi, Migros,
 * Breuninger, Rewe, Edeka and Bestseller are private or co-operative, so no EU regulated
 * market requires anything of them. Several of them do file annual accounts nationally —
 * Germany's Bundesanzeiger, Denmark's Erhvervsstyrelsen — and those are separate
 * connectors with separate shapes, not this one.
 */

import { sql } from 'drizzle-orm';
import { db } from '@mios/database';
import { buildIndex, resolveCompany, type Filer } from './lib/edgar-matching';

const BASE = 'https://filings.xbrl.org';
const CONTACT = (process.env.SEC_CONTACT_EMAIL ?? '').trim();
const UA = `NORTH-MarketIntelligence/0.1 (${CONTACT || 'https://github.com/northjd/NORTHJD'})`;

/** Surfaces in the Actions UI rather than only in a log nobody opens. */
const warn = (msg: string): void => {
  console.log(`::warning title=ESEF::${msg}`);
  console.error(`[esef] ${msg}`);
};

/** No published rate limit; this is politeness, not compliance. */
const GAP_MS = 400;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get<T>(path: string): Promise<T | null> {
  const res = await fetch(path.startsWith('http') ? path : `${BASE}${path}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/*
 * A fact that describes the whole group and nothing narrower.
 *
 * xBRL-JSON puts segment breakdowns in the same `facts` object as the consolidated
 * figures, distinguished only by extra keys in `dimensions`. Adyen's 2025 filing carries
 * 312 undimensioned facts and 101 dimensional ones; taking any fact bearing the right
 * concept would mix a segment into the group total, which is the shape of error that
 * gave Ahold Delhaize $3.67bn of revenue against an actual €89bn.
 *
 * One axis is not a breakdown, though, and refusing it costs real filings: some issuers
 * tag every figure with `ConsolidatedAndSeparateFinancialStatementsAxis` to say which
 * set of accounts it belongs to. `ConsolidatedMember` is exactly what we want.
 *
 * `SeparateMember` is exactly what we do not, and this is not a technicality. The
 * Maersk A/S filing in the index tags all 230 of its facts that way: those are the
 * parent company's standalone accounts, $36.96bn of revenue where the group reports
 * around $56bn. Publishing that as "Maersk revenue" would be a real number describing
 * the wrong thing.
 */
const CORE_DIMENSIONS = new Set(['concept', 'entity', 'period', 'unit', 'language', 'noteId']);
const SCOPE_AXIS = 'ifrs-full:ConsolidatedAndSeparateFinancialStatementsAxis';
const CONSOLIDATED = 'ifrs-full:ConsolidatedMember';

/** True when a fact is the group's own figure rather than a segment or a parent-only one. */
function isGroupWide(dimensions: Record<string, string>): boolean {
  for (const [axis, member] of Object.entries(dimensions)) {
    if (CORE_DIMENSIONS.has(axis)) continue;
    if (axis === SCOPE_AXIS && member === CONSOLIDATED) continue;
    return false;
  }
  return true;
}

interface JsonFact {
  value: string;
  dimensions?: Record<string, string>;
}

interface AnnualFact {
  value: number;
  currency: string;
  /** The closing date, as `YYYY-MM-DD`. */
  end: string;
}

/**
 * The last day of a period whose end is written exclusively.
 *
 * `2026-01-01T00:00:00` is the instant after a year that ended on 2025-12-31, so the
 * closing date is the day before. Anchored to UTC deliberately: the timestamps carry no
 * zone, and letting them parse as local time moved every December year-end into
 * December 30th on a machine two hours ahead of UTC.
 */
function exclusiveEndToClosingDate(end: string): string {
  const day = new Date(`${end.slice(0, 10)}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

/** `2025-01-01T00:00:00/2026-01-01T00:00:00` → 365 */
const durationDays = (period: string): number => {
  const [from, to] = period.split('/');
  if (!from || !to) return 0;
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
};

/**
 * Consolidated annual values for a concept, newest first.
 *
 * A single ESEF filing carries the reported year and its comparative, which is why the
 * growth rate below costs no second download: both figures are already here, filed
 * together by the same company on the same basis.
 */
function annualSeries(facts: JsonFact[], concepts: readonly string[]): AnnualFact[] {
  for (const concept of concepts) {
    const rows = facts
      .filter((f) => {
        const d = f.dimensions;
        if (!d || d.concept !== concept) return false;
        if (!isGroupWide(d)) return false;
        const period = d.period ?? '';
        if (!period.includes('/')) return false;
        const days = durationDays(period);
        return days >= 350 && days <= 380;
      })
      .map((f) => {
        const period = f.dimensions!.period!;
        return {
          value: Number(f.value),
          currency: (f.dimensions!.unit ?? '').split(':').pop() ?? '',
          // The period end is exclusive in xBRL-JSON: a year ending 31 December is
          // written as running to 1 January. Reporting that date would put every
          // December year-end into the following year.
          //
          // Done on the date string in UTC, not with Date.parse. These timestamps carry
          // no zone, so they parse as local time; subtracting a day and calling
          // toISOString then shifted every year-end back across midnight and printed
          // "2025-12-30" for a year that ended on the 31st.
          end: exclusiveEndToClosingDate(period.split('/')[1]!),
        };
      })
      .filter((r) => Number.isFinite(r.value) && r.currency.length === 3);

    // Same concept, same year, filed twice — statement and note. Keep one per year.
    const byYear = new Map<string, AnnualFact>();
    for (const row of rows) if (!byYear.has(row.end)) byYear.set(row.end, row);
    const series = [...byYear.values()].sort((a, b) => (a.end < b.end ? 1 : -1));
    if (series.length > 0) return series;
  }
  return [];
}

const REVENUE = ['ifrs-full:Revenue', 'ifrs-full:RevenueFromContractsWithCustomers'] as const;
const OPERATING = ['ifrs-full:ProfitLossFromOperatingActivities'] as const;
const NET = ['ifrs-full:ProfitLoss'] as const;

const SYMBOL: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', JPY: '¥' };

/** Identical to the EDGAR renderer, deliberately: one house style for a filed figure. */
const money = (v: number, currency: string): string => {
  const symbol = SYMBOL[currency];
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  const magnitude =
    abs >= 1e12
      ? `${(abs / 1e12).toFixed(2)}tn`
      : abs >= 1e9
        ? `${(abs / 1e9).toFixed(2)}bn`
        : abs >= 1e6
          ? `${(abs / 1e6).toFixed(0)}m`
          : abs.toLocaleString('en-GB');
  return symbol ? `${sign}${symbol}${magnitude}` : `${sign}${currency} ${magnitude}`;
};

interface EntityRow {
  type: string;
  id: string;
  attributes: { identifier: string | null; name: string | null };
}
interface FilingRow {
  attributes: {
    period_end: string;
    country: string;
    json_url: string | null;
    /** The Inline XBRL viewer for this filing. Given by the API — never constructed. */
    viewer_url: string | null;
  };
}

async function main(): Promise<void> {
  const index = await get<{ data: EntityRow[] }>('/api/entities?page%5Bsize%5D=20000');
  if (!index?.data?.length) {
    warn('filings.xbrl.org returned no entity index. Profiles left untouched.');
    process.exit(0);
  }

  // 36 of the 7,357 entities carry a null name. A registry is allowed holes; a matcher
  // that trips over one is not, but there is nothing to match on either.
  const named = index.data.filter((e) => e.attributes.name && e.attributes.identifier);
  const filers: Filer[] = named.map((e, i) => ({
    cik_str: i,
    ticker: '',
    title: e.attributes.name!,
  }));
  const leiByIndex = named.map((e) => e.attributes.identifier!);
  const matcher = buildIndex(filers);
  console.log(`[esef] index: ${named.length} entities with a name`);

  const entities = (
    await db().execute(
      sql`select id, slug, name, legal_name as "legalName", ticker, cik from entities order by name`,
    )
  ).rows as {
    id: string;
    slug: string;
    name: string;
    legalName: string | null;
    ticker: string | null;
    cik: string | null;
  }[];

  let matched = 0;
  let written = 0;
  let skippedHasEdgar = 0;
  const stale: string[] = [];
  /*
   * Matched a filer and wrote nothing.
   *
   * Worth naming rather than counting: it is the difference between "this company is not
   * in the register" and "it is, and we could not read its filing" — and only the second
   * is ours to fix.
   */
  const unreadable: string[] = [];

  for (const e of entities) {
    /*
     * Never overwrite an SEC filing we already have.
     *
     * Keyed on `cik`, which only the EDGAR script sets — not on whether a profile
     * exists. Checking for a profile would have skipped the ones this script wrote on
     * its own previous run, and since the corpus is now carried between runs, those
     * would have frozen at whatever year they were first written in.
     *
     * Six companies file both a 20-F with the SEC and an ESEF report in Europe. The two
     * should agree; re-fetching 1.6 MB to confirm costs bandwidth and buys nothing, and
     * replacing a figure whose "filing" link points at the SEC would make that link
     * wrong.
     */
    if (e.cik) {
      skippedHasEdgar += 1;
      continue;
    }

    const { filer } = resolveCompany(matcher, e);
    if (!filer) continue;
    matched += 1;
    const lei = leiByIndex[filer.cik_str]!;

    await sleep(GAP_MS);
    const filings = await get<{ data: FilingRow[] }>(`/api/entities/${lei}/filings`);
    const candidates = (filings?.data ?? [])
      .filter((f) => f.attributes.json_url)
      .sort((a, b) => {
        // Newest first; among filings for the same period, the English rendering.
        // Finnish and Nordic issuers file the same report twice, once in each language,
        // and taking whichever the index happened to return first gave Kesko a set of
        // Finnish labels.
        if (a.attributes.period_end !== b.attributes.period_end) {
          return a.attributes.period_end < b.attributes.period_end ? 1 : -1;
        }
        const english = (f: FilingRow) => (/-en\b|-en\./.test(f.attributes.json_url ?? '') ? 0 : 1);
        return english(a) - english(b);
      });
    if (candidates.length === 0) continue;

    /*
     * Stale means wrong, here — the same rule EDGAR uses.
     *
     * A company that stopped filing, or whose index entry stopped being updated, still
     * has an entry. A four-year-old revenue on a page headed "latest annual" is a false
     * statement however carefully it is dated.
     */
    const newest = candidates[0]!.attributes.period_end;
    const ageYears = (Date.now() - Date.parse(newest)) / (365.25 * 86_400_000);
    if (ageYears > 3) {
      stale.push(`${e.name} (latest filing was ${newest})`);
      continue;
    }

    /*
     * Work down the filings until one yields a consolidated annual, rather than giving
     * up on the newest.
     *
     * The index carries interim reports alongside annual ones — Carlsberg's most recent
     * entry is a half-year — and some filings tag their primary statements in a shape
     * this cannot read. Both are reasons to look at the year before, not reasons to
     * leave the company blank.
     */
    let chosen: FilingRow | null = null;
    let revenue: AnnualFact[] = [];
    let facts: JsonFact[] = [];
    for (const candidate of candidates.slice(0, 4)) {
      await sleep(GAP_MS);
      const report = await get<{ facts: Record<string, JsonFact> }>(
        `${BASE}${candidate.attributes.json_url}`,
      );
      if (!report?.facts) continue;
      const parsed = Object.values(report.facts);
      const series = annualSeries(parsed, REVENUE);
      if (series.length === 0) continue;
      chosen = candidate;
      revenue = series;
      facts = parsed;
      break;
    }
    if (!chosen || revenue.length === 0) {
      unreadable.push(
        `${e.name} → ${filer.title} (${candidates.length} filings, newest ${newest})`,
      );
      continue;
    }
    const current = revenue[0]!;

    // Every measure on the same year and the same currency, or the margin below is two
    // unrelated numbers divided.
    const sameYear = (series: AnnualFact[]) =>
      series.find((f) => f.end === current.end && f.currency === current.currency) ?? null;
    const operating = sameYear(annualSeries(facts, OPERATING));
    const net = sameYear(annualSeries(facts, NET));

    /*
     * The viewer URL the API gives, not one derived from the JSON path.
     *
     * Deriving it produced a 404 on every single figure: the real path carries an extra
     * `<report-name>/reports/` segment that a filename substitution cannot know about.
     * A page whose whole claim is "every figure links to the filing it came from" cannot
     * afford a link that does not resolve, and this one was published before anyone
     * clicked it.
     */
    const viewer = chosen.attributes.viewer_url
      ? `${BASE}${chosen.attributes.viewer_url}`
      : `${BASE}/${lei}`;
    const profile: { label: string; value: string; sourceUrl: string }[] = [
      {
        label: 'Latest annual revenue',
        value: `${money(current.value, current.currency)} — FY ending ${current.end}`,
        sourceUrl: viewer,
      },
    ];

    // The comparative is in the same filing, filed by the same company on the same
    // basis, so the growth rate needs no second download and no second assumption.
    const prior = revenue.find((f) => f.end < current.end && f.currency === current.currency);
    if (prior && prior.value > 0) {
      const pct = ((current.value - prior.value) / prior.value) * 100;
      profile.push({
        label: 'Revenue growth',
        value: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% — ${money(prior.value, prior.currency)} (FY ${prior.end}) to ${money(current.value, current.currency)} (FY ${current.end})`,
        sourceUrl: viewer,
      });
    }
    if (operating) {
      profile.push({
        label: 'Operating income',
        value: `${money(operating.value, operating.currency)} — FY ending ${operating.end}`,
        sourceUrl: viewer,
      });
      if (current.value > 0) {
        profile.push({
          label: 'Operating margin',
          value: `${((operating.value / current.value) * 100).toFixed(1)}% — ${money(operating.value, operating.currency)} on ${money(current.value, current.currency)}, FY ending ${current.end}`,
          sourceUrl: viewer,
        });
      }
    }
    if (net) {
      profile.push({
        label: 'Net income',
        value: `${money(net.value, net.currency)} — FY ending ${net.end}`,
        sourceUrl: viewer,
      });
    }

    await db().execute(sql`
      update entities
         set public_profile = ${sql.param(JSON.stringify(profile))}::jsonb
       where id = ${sql.param(e.id)}
    `);
    written += 1;
    console.log(
      `[esef] ${e.name} → ${filer.title} · ${profile.length} figures · FY ${current.end}`,
    );
  }

  console.log(
    `[esef] ${matched} matched an ESEF filer · ${written} profiles written · ${skippedHasEdgar} already had an SEC filing`,
  );
  if (written === 0 && matched > 0) {
    warn('Matched ESEF filers but wrote no profiles — every filing lacked a clean annual.');
  }
  if (stale.length) {
    console.log(`[esef] ${stale.length} skipped for stale filings:`);
    for (const s of stale) console.log(`          ${s}`);
  }
  if (unreadable.length) {
    console.log(`[esef] ${unreadable.length} matched a filer but had no consolidated annual:`);
    for (const s of unreadable) console.log(`          ${s}`);
  }
  process.exit(0);
}

await main();
