/**
 * Company financials from SEC EDGAR, and nothing that is not in a filing.
 *
 * The company page had to render revenue, margin and headcount as "not available from
 * monitored sources", because a corpus built from news feeds does not carry a balance
 * sheet. EDGAR does, it is free, and it permits automated access under a declared user
 * agent — the registry has said so since the source was first registered, with the
 * connector off because nobody had written one.
 *
 * What this deliberately does not do:
 *
 *   - **No market capitalisation.** EDGAR publishes `EntityPublicFloat`, which is the
 *     value of shares held by non-affiliates at a point in time. It is not market cap and
 *     labelling it so would be a quiet lie. It is written as "public float", with its own
 *     date, and market cap stays absent.
 *   - **No headcount.** `EntityNumberOfEmployees` is simply not filed by most registrants
 *     — Philip Morris does not report it in XBRL — so it stays absent rather than being
 *     scraped out of prose.
 *   - **No derived ratios beyond operating margin**, which is two filed numbers divided
 *     and is shown with both.
 *   - **No estimates, ever.** A company with no matching filer keeps an empty profile.
 *
 * Coverage is about a third of the tracked companies: US filers only, so Aldi,
 * Breuninger, Bestseller and Adyen are permanently outside it. That is a property of the
 * source, and the page already knows how to say a figure is missing.
 */

import { sql } from 'drizzle-orm';
import { db } from '@mios/database';

const UA =
  process.env.INGEST_USER_AGENT ?? 'NORTH-MarketIntelligence/0.1 (+contact: set-your-email)';

/** SEC asks for no more than 10 requests a second. Half that is polite and plenty. */
const GAP_MS = 200;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const get = async (url: string): Promise<any | null> => {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) return null;
  return res.json();
};

type Unit = {
  val: number;
  start?: string;
  end: string;
  form?: string;
  fp?: string;
  filed?: string;
  accn?: string;
  frame?: string;
};

const days = (a: string, b: string): number =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/**
 * The consolidated annual figure, or nothing.
 *
 * This is where the first version was wrong, and wrong in the worst direction: it took
 * the latest entry of any kind bearing the tag, so Ahold Delhaize reported $3.67bn of
 * revenue against an actual €89bn, and Accenture $17.6bn against $69bn. XBRL carries
 * segment breakdowns, quarterly slices and restatements under the same tag, and picking
 * the last one by date picks a fragment.
 *
 * Two filters, in order of trustworthiness:
 *
 *   1. **A calendar-year frame.** The SEC stamps `frame: "CY2025"` on the value it
 *      considers the consolidated annual figure — no dimensions, no quarter. Where one
 *      exists it is definitive.
 *   2. **An annual duration in an annual report.** Filers whose year does not end in
 *      December never get a plain `CY####` frame, so a 10-K entry spanning 350–380 days
 *      is accepted instead.
 *
 * Anything else returns null and the company keeps an empty profile. A missing figure
 * costs a line of "not available"; a wrong one costs the argument the product is built
 * on.
 */
function annualFlow(
  facts: any,
  taxonomy: string,
  tags: readonly string[],
  pinTo?: string,
): Unit | null {
  const bucket = facts?.[taxonomy];
  if (!bucket) return null;
  for (const tag of tags) {
    const units = bucket[tag]?.units;
    if (!units) continue;
    const series: Unit[] = (Object.values(units).flat() as Unit[]).filter(
      (u) => u.start && days(u.start, u.end) >= 350 && days(u.start, u.end) <= 380,
    );
    const framed = series.filter((u) => /^CY\d{4}$/.test(u.frame ?? ''));
    const annualReport = series.filter((u) => u.form === '10-K' && u.fp === 'FY');
    const pool = framed.length ? framed : annualReport;
    if (!pool.length) continue;

    // Every measure must describe the same year, or the margin is two unrelated numbers
    // divided and the panel reads as one period when it is several.
    const scoped = pinTo ? pool.filter((u) => u.end === pinTo) : pool;
    if (!scoped.length) continue;
    return scoped.sort((a, b) => (a.end < b.end ? -1 : 1))[scoped.length - 1]!;
  }
  return null;
}

/** Point-in-time values carry no duration, so they are selected on recency alone. */
function latestPoint(facts: any, taxonomy: string, tags: readonly string[]): Unit | null {
  const bucket = facts?.[taxonomy];
  if (!bucket) return null;
  for (const tag of tags) {
    const units = bucket[tag]?.units;
    if (!units) continue;
    const series: Unit[] = Object.values(units).flat() as Unit[];
    if (!series.length) continue;
    return series.sort((a, b) => (a.end < b.end ? -1 : 1))[series.length - 1]!;
  }
  return null;
}

const REVENUE_TAGS = [
  'RevenueFromContractWithCustomerExcludingAssessedTax',
  'Revenues',
  'RevenueFromContractWithCustomerIncludingAssessedTax',
  'SalesRevenueNet',
] as const;

/** The year before `current`, from the same tag, so a growth rate compares like with like. */
function priorAnnual(
  facts: any,
  taxonomy: string,
  tags: readonly string[],
  current: Unit,
): Unit | null {
  const bucket = facts?.[taxonomy];
  if (!bucket) return null;
  for (const tag of tags) {
    const units = bucket[tag]?.units;
    if (!units) continue;
    const series: Unit[] = (Object.values(units).flat() as Unit[]).filter(
      (u) =>
        u.start &&
        days(u.start, u.end) >= 350 &&
        days(u.start, u.end) <= 380 &&
        (/^CY\d{4}$/.test(u.frame ?? '') || (u.form === '10-K' && u.fp === 'FY')) &&
        u.end < current.end,
    );
    if (!series.length) continue;
    const candidate = series.sort((a, b) => (a.end < b.end ? -1 : 1))[series.length - 1]!;
    // Adjacent years only: a two-year gap is not a growth rate.
    const gap = days(candidate.end, current.end);
    return gap >= 330 && gap <= 400 ? candidate : null;
  }
  return null;
}

const money = (v: number): string => {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}bn`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(0)}m`;
  return `$${v.toLocaleString('en-GB')}`;
};

/** A link to the filing the number came from, so every figure is checkable in one click. */
const filingUrl = (cik: string, u: Unit): string => {
  if (!u.accn) return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}`;
  const bare = u.accn.replace(/-/g, '');
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${bare}/${u.accn}-index.htm`;
};

async function main(): Promise<void> {
  const tickers = await get('https://www.sec.gov/files/company_tickers.json');
  if (!tickers) {
    console.error('[edgar] could not fetch the filer index; leaving profiles untouched');
    process.exit(0);
  }
  const filers = Object.values(tickers) as { cik_str: number; ticker: string; title: string }[];

  /*
   * The name decides. The ticker is not evidence.
   *
   * Matching on ticker attributed six companies' financials to entirely different
   * businesses, because tickers are unique per exchange and not globally: Ahold Delhaize
   * is AD in Amsterdam and Array Digital Infrastructure is AD in New York, Danone is BN
   * in Paris and Brookfield is BN in Toronto, LVMH is MC in Paris and Moelis is MC in New
   * York. Richemont, L'Oréal and Telstra collided the same way. Every one produced a
   * plausible-looking revenue figure for the wrong company, which is the single worst
   * thing this product could do.
   *
   * So a filer is accepted only when the names agree after folding diacritics, stripping
   * apostrophes and dropping corporate suffixes. It fails closed: Google does not match
   * Alphabet and simply keeps an empty profile, which costs one line of "not available"
   * and no credibility.
   */
  const norm = (s: string): string =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['\u2019]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(
        /\b(inc|corp|corporation|company|companies|co|plc|nv|sa|ag|se|group|holding|holdings|ltd|limited|the|de)\b/g,
        ' ',
      )
      .replace(/\s+/g, ' ')
      .trim();

  const named = filers.map((f) => ({ ...f, key: norm(f.title) }));
  const byName = new Map(named.map((f) => [f.key, f]));

  const resolve = (entityName: string, ticker: string) => {
    const key = norm(entityName);
    if (!key) return null;
    const exact = byName.get(key);
    if (exact) return exact;
    // A containment match needs enough characters to be meaningful; "on" inside
    // "onsemi" is a coincidence, "philip morris international" inside a longer legal
    // name is not.
    /*
     * Containment alone is not enough either.
     *
     * "coca cola hbc" is contained in nothing, but "coca cola" is contained in both the
     * bottler and the brand owner — and the bottler was handed the brand owner's $47.9bn
     * against its own ~€10bn. "valio" matched a shell with $780,000 of revenue. So the
     * two names must also be close in length: a genuine variant differs by a suffix, not
     * by half the string.
     */
    const candidates = named.filter((f) => {
      if (key.length < 5 || f.key.length < 5) return false;
      if (!f.key.includes(key) && !key.includes(f.key)) return false;
      const shorter = Math.min(key.length, f.key.length);
      const longer = Math.max(key.length, f.key.length);
      return shorter / longer >= 0.75;
    });
    if (candidates.length === 1) return candidates[0]!;
    // Several plausible names: the ticker is allowed to break the tie, never to make it.
    return candidates.find((c) => c.ticker.toUpperCase() === ticker) ?? null;
  };

  const entities = (
    await db().execute(sql`select id, slug, name, ticker from entities order by name`)
  ).rows as { id: string; slug: string; name: string; ticker: string | null }[];

  let matched = 0;
  let written = 0;
  const stale: string[] = [];

  for (const e of entities) {
    const filer = resolve(e.name, (e.ticker ?? '').toUpperCase());
    if (!filer) continue;
    matched++;

    const cik = String(filer.cik_str).padStart(10, '0');
    await sleep(GAP_MS);
    const facts = await get(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`);
    if (!facts?.facts) continue;

    const f = facts.facts;
    const revenue = annualFlow(f, 'us-gaap', REVENUE_TAGS);

    /*
     * No revenue, no profile.
     *
     * Without a consolidated annual figure there is no period to pin the rest to, and an
     * operating income floating free of the revenue it was earned on is worse than
     * silence. Foreign private issuers filing 20-F rather than 10-K land here, which is
     * correct: EDGAR does not hold their consolidated annuals in this shape.
     */
    if (!revenue) continue;

    /*
     * Stale means wrong, here.
     *
     * Kraft Heinz resolved to a 2014 revenue and NVIDIA to 2022 — not because those are
     * the latest filings but because the tag chosen stopped being used and the newest
     * clean annual under it is years old. A twelve-year-old revenue on a page headed
     * "latest annual revenue" is a false statement however carefully it is dated, and a
     * market-intelligence tool that reports 2014 figures is worse than one that reports
     * none.
     */
    const ageYears = (Date.now() - Date.parse(revenue.end)) / (365.25 * 86_400_000);
    if (ageYears > 3) {
      stale.push(`${e.name} (latest clean annual was ${revenue.end})`);
      continue;
    }

    const period = revenue.end;

    const operating = annualFlow(f, 'us-gaap', ['OperatingIncomeLoss'], period);
    const net = annualFlow(f, 'us-gaap', ['NetIncomeLoss'], period);
    const float = latestPoint(f, 'dei', ['EntityPublicFloat']);
    const employees = latestPoint(f, 'dei', ['EntityNumberOfEmployees']);

    const profile: { label: string; value: string; sourceUrl: string }[] = [];
    const add = (label: string, u: Unit | null, render: (u: Unit) => string) => {
      if (!u) return;
      profile.push({
        label,
        value: `${render(u)} — FY ending ${u.end}${u.filed ? `, filed ${u.filed}` : ''}`,
        sourceUrl: filingUrl(cik, u),
      });
    };

    add('Latest annual revenue', revenue, (u) => money(u.val));

    /*
     * Growth from two filed revenues, never from one.
     *
     * Both years are shown so the reader can check the arithmetic, and it is only
     * computed when the prior year comes from the same tag — comparing a figure filed
     * under one revenue concept against another is how a restatement becomes a trend.
     */
    const prior = priorAnnual(f, 'us-gaap', REVENUE_TAGS, revenue);
    if (prior && prior.val > 0) {
      const pct = ((revenue.val - prior.val) / prior.val) * 100;
      profile.push({
        label: 'Revenue growth',
        value: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% — ${money(prior.val)} (FY ${prior.end}) to ${money(revenue.val)} (FY ${revenue.end})`,
        sourceUrl: filingUrl(cik, revenue),
      });
    }
    add('Operating income', operating, (u) => money(u.val));
    add('Net income', net, (u) => money(u.val));

    // Two filed numbers divided, shown with both, rather than a ratio out of nowhere.
    if (operating && revenue.val > 0) {
      profile.push({
        label: 'Operating margin',
        value: `${((operating.val / revenue.val) * 100).toFixed(1)}% — ${money(operating.val)} on ${money(revenue.val)}, FY ending ${revenue.end}`,
        sourceUrl: filingUrl(cik, revenue),
      });
    }

    // Deliberately not called market capitalisation: it is the non-affiliate holding.
    add('Public float', float, (u) => money(u.val));
    add('Employees', employees, (u) => u.val.toLocaleString('en-GB'));

    if (profile.length === 0) continue;

    await db().execute(sql`
      update entities
         set cik = ${sql.param(cik)},
             public_profile = ${sql.param(JSON.stringify(profile))}::jsonb
       where id = ${sql.param(e.id)}
    `);
    written++;
  }

  console.log(
    `[edgar] ${matched} of ${entities.length} companies matched a filer · ${written} profiles written`,
  );
  if (stale.length) {
    console.log(`[edgar] ${stale.length} skipped for stale figures:`);
    for (const s of stale) console.log(`          ${s}`);
  }
  process.exit(0);
}

await main();
