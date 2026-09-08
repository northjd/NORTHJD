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
 * Coverage is about a third of the tracked companies, and it is no longer US-only.
 * Foreign private issuers file a 20-F with the SEC under the `ifrs-full` taxonomy rather
 * than a 10-K under `us-gaap`, and reading only the latter is what made this look like a
 * US-only source: Stellantis, Nokia, Ericsson, Unilever, Novo Nordisk and British
 * American Tobacco were all in EDGAR the whole time, in a shape the script did not read.
 *
 * They report in their own currency — DKK, SEK, GBP, EUR — which the first version would
 * have rendered with a dollar sign. Every figure now carries the currency it was filed
 * in, and no figure is ever converted: an exchange rate is a number we would have had to
 * invent, and the rate on which date is a question with no honest default.
 *
 * Still outside it, and permanently: companies that file nowhere in the United States.
 * Aldi, Migros, Breuninger, Bestseller and Rewe are private, or listed only in Europe, so
 * EDGAR holds nothing on them at all. The page already knows how to say a figure is
 * missing.
 */

import { sql } from 'drizzle-orm';
import { db } from '@mios/database';
import { buildIndex, resolveFiler, type Filer } from './lib/edgar-matching';

/*
 * SEC wants a contact address, and refuses anything else.
 *
 * Their fair-access policy asks for a User-Agent carrying an email so they can reach
 * whoever is running the bot. A URL does not satisfy it: the workflow sent
 * `(+https://github.com/northjd/NORTHJD)` and got 403 on every request, while the same
 * code with an email got 200. It worked locally and was refused on CI, which is the
 * worst shape of failure.
 *
 * Read from a secret rather than committed, because an address in a public repository is
 * an address in a scraper — the same reason the feedback widget does not carry one.
 */
const CONTACT = (process.env.SEC_CONTACT_EMAIL ?? '').trim();
const UA = `NORTH-MarketIntelligence/0.1 (${CONTACT})`;

/** Surfaces in the Actions UI rather than only in a log nobody opens. */
const warn = (msg: string): void => {
  console.log(`::warning title=EDGAR::${msg}`);
  console.error(`[edgar] ${msg}`);
};

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
  /**
   * The unit the value was filed in — `USD`, `EUR`, `SEK`, and for headcount `pure`.
   *
   * XBRL nests values under the unit, and the first version flattened that away. On a
   * US filer nothing was lost; on Stellantis it would have printed €153.5bn as $153.5bn,
   * which is a fabricated number wearing a real one's clothes.
   */
  currency: string;
};

/** Every value for a tag, each carrying the unit it was filed under. */
function unitSeries(facts: any, taxonomy: string, tag: string): Unit[] {
  const units = facts?.[taxonomy]?.[tag]?.units;
  if (!units) return [];
  return Object.entries(units).flatMap(([currency, list]) =>
    (list as Omit<Unit, 'currency'>[]).map((u) => ({ ...u, currency })),
  );
}

/**
 * Annual report forms, across the two filer populations EDGAR holds.
 *
 * `10-K` is a domestic registrant, `20-F` a foreign private issuer and `40-F` a Canadian
 * one under the multijurisdictional system. All three are the audited annual; a `6-K` is
 * an interim furnished report and is deliberately absent.
 */
const ANNUAL_FORMS = new Set(['10-K', '20-F', '40-F']);

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
  pin?: { end?: string; currency?: string },
): Unit | null {
  const perTag: Unit[] = [];

  for (const tag of tags) {
    const series = unitSeries(facts, taxonomy, tag).filter(
      (u) => u.start && days(u.start, u.end) >= 350 && days(u.start, u.end) <= 380,
    );
    const framed = series.filter((u) => /^CY\d{4}$/.test(u.frame ?? ''));
    const annualReport = series.filter((u) => ANNUAL_FORMS.has(u.form ?? '') && u.fp === 'FY');
    const pool = framed.length ? framed : annualReport;
    if (!pool.length) continue;

    /*
     * Every measure must describe the same year *and* the same currency.
     *
     * The year, or the margin is two unrelated numbers divided and the panel reads as
     * one period when it is several. The currency, because a filer that also reports a
     * USD convenience translation has both in the same tag, and revenue in euros over
     * operating income in dollars is a ratio of nothing.
     */
    const scoped = pool.filter(
      (u) => (!pin?.end || u.end === pin.end) && (!pin?.currency || u.currency === pin.currency),
    );
    if (!scoped.length) continue;
    perTag.push(scoped.sort((a, b) => (a.end < b.end ? -1 : 1))[scoped.length - 1]!);
  }

  if (!perTag.length) return null;

  /*
   * The newest year across the tags, not the first tag that has one.
   *
   * Companies change the concept they report revenue under, and the old tag keeps its
   * history. Taking the first tag in the list meant NVIDIA reported a 2022 revenue and
   * Kraft Heinz a 2014 one — not the latest filing, just the latest use of a tag they
   * had stopped using. Both were then dropped by the staleness guard, so the page said
   * "not available" about two of the best-documented companies in the corpus.
   *
   * List order still decides a tie, which is where it belongs: it encodes which concept
   * is more specific, and that only matters between figures for the same year.
   */
  return perTag.reduce((best, u) => (u.end > best.end ? u : best));
}

/** Point-in-time values carry no duration, so they are selected on recency alone. */
function latestPoint(facts: any, taxonomy: string, tags: readonly string[]): Unit | null {
  for (const tag of tags) {
    const series = unitSeries(facts, taxonomy, tag);
    if (!series.length) continue;
    return series.sort((a, b) => (a.end < b.end ? -1 : 1))[series.length - 1]!;
  }
  return null;
}

/**
 * The same three measures, named differently by the two accounting standards.
 *
 * Reading only the `us-gaap` set is what made this look like a US-only source. A foreign
 * private issuer's 20-F is tagged under `ifrs-full`, where revenue is `Revenue` and
 * operating income is `ProfitLossFromOperatingActivities`. Order matters within each
 * list: the first tag that yields a clean consolidated annual wins, so the most specific
 * concept comes first.
 */
const TAXONOMIES = [
  {
    name: 'us-gaap',
    revenue: [
      'RevenueFromContractWithCustomerExcludingAssessedTax',
      'Revenues',
      'RevenueFromContractWithCustomerIncludingAssessedTax',
      'SalesRevenueNet',
    ],
    operating: ['OperatingIncomeLoss'],
    net: ['NetIncomeLoss'],
  },
  {
    name: 'ifrs-full',
    revenue: ['RevenueFromContractsWithCustomers', 'Revenue'],
    operating: ['ProfitLossFromOperatingActivities'],
    // `ProfitLoss` is profit for the period including non-controlling interests, which
    // is the line IFRS calls net profit. Not `ProfitLossBeforeTax`.
    net: ['ProfitLoss'],
  },
] as const;

/** The year before `current`, from the same tag, so a growth rate compares like with like. */
function priorAnnual(
  facts: any,
  taxonomy: string,
  tags: readonly string[],
  current: Unit,
): Unit | null {
  for (const tag of tags) {
    const series = unitSeries(facts, taxonomy, tag).filter(
      (u) =>
        u.start &&
        days(u.start, u.end) >= 350 &&
        days(u.start, u.end) <= 380 &&
        (/^CY\d{4}$/.test(u.frame ?? '') || (ANNUAL_FORMS.has(u.form ?? '') && u.fp === 'FY')) &&
        // Same currency, or the growth rate is an unstated exchange-rate movement.
        u.currency === current.currency &&
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

/**
 * The number, in the currency it was filed in — never converted.
 *
 * Converting would need a rate, and a rate needs a date: the balance-sheet date, the
 * average for the year, today? Each gives a different answer and none of them is in the
 * filing. So Novo Nordisk's revenue reads DKK 309.06bn, and a reader who wants dollars
 * knows they are the one doing the conversion.
 */
const SYMBOL: Record<string, string> = { USD: '$', EUR: '\u20ac', GBP: '\u00a3', JPY: '\u00a5' };

const money = (v: number, currency: string): string => {
  const symbol = SYMBOL[currency];
  const abs = Math.abs(v);
  // Sign outside the unit: Stellantis's 2025 operating loss read "€-26.25bn", which
  // looks like a typo rather than a number.
  const sign = v < 0 ? '-' : '';
  // A trillion tier, because NVIDIA's public float rendered as "$4000.00bn".
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

/** A link to the filing the number came from, so every figure is checkable in one click. */
const filingUrl = (cik: string, u: Unit): string => {
  if (!u.accn) return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}`;
  const bare = u.accn.replace(/-/g, '');
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${bare}/${u.accn}-index.htm`;
};

async function main(): Promise<void> {
  /*
   * Skipping loudly beats failing silently.
   *
   * The first version exited 0 whatever happened, so a step that fetched nothing reported
   * success and the site published without financials while the run showed all green.
   * That is the same defect as a feedback button that swallows the message. It still does
   * not fail the build — one refused source should never stop publication, exactly as a
   * 403 from a news feed does not — but it now says so where it can be seen.
   */
  if (!CONTACT) {
    warn(
      'SEC_CONTACT_EMAIL is not set, so no financials were fetched. SEC requires a contact ' +
        'address in the User-Agent. Add it as a repository secret to enable this step.',
    );
    process.exit(0);
  }

  const tickers = await get('https://www.sec.gov/files/company_tickers.json');
  if (!tickers) {
    warn(
      `SEC refused the filer index for User-Agent "${UA}". Their fair-access policy wants a ` +
        'real contact email. Profiles left untouched.',
    );
    process.exit(0);
  }
  const filers = Object.values(tickers) as Filer[];

  /*
   * The name decides. The ticker corroborates. Neither alone is enough.
   *
   * The rules, and the six mis-attributions that produced them, live in
   * `scripts/lib/edgar-matching.ts` — extracted so those six can be regression tests
   * rather than a comment nobody can run.
   */
  const index = buildIndex(filers);
  const refused: string[] = [];

  const entities = (
    await db().execute(sql`select id, slug, name, ticker from entities order by name`)
  ).rows as { id: string; slug: string; name: string; ticker: string | null }[];

  let matched = 0;
  let written = 0;
  const stale: string[] = [];

  for (const e of entities) {
    const { filer, reason, detail } = resolveFiler(index, e.name, e.ticker);
    if (!filer) {
      if (reason === 'ambiguous') refused.push(`${e.name}: ${detail}`);
      continue;
    }
    matched++;

    const cik = String(filer.cik_str).padStart(10, '0');
    await sleep(GAP_MS);
    const facts = await get(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`);
    if (!facts?.facts) continue;

    const f = facts.facts;

    /*
     * Whichever standard the filer reports under, and only one of them.
     *
     * A dual filer can carry both taxonomies; taking the first that yields a clean
     * consolidated annual keeps every measure on one basis, which is what makes the
     * operating margin below a real ratio rather than an IFRS numerator over a US-GAAP
     * denominator.
     */
    let standard: (typeof TAXONOMIES)[number] | null = null;
    let revenue: Unit | null = null;
    for (const candidate of TAXONOMIES) {
      const found = annualFlow(f, candidate.name, candidate.revenue);
      if (found) {
        standard = candidate;
        revenue = found;
        break;
      }
    }

    /*
     * No revenue, no profile.
     *
     * Without a consolidated annual figure there is no period to pin the rest to, and an
     * operating income floating free of the revenue it was earned on is worse than
     * silence. What lands here now is a filer with no annual in either taxonomy —
     * typically an unsponsored ADR line that has a ticker and no filings of its own.
     */
    if (!revenue || !standard) continue;

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

    const pin = { end: revenue.end, currency: revenue.currency };

    const operating = annualFlow(f, standard.name, standard.operating, pin);
    const net = annualFlow(f, standard.name, standard.net, pin);
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

    add('Latest annual revenue', revenue, (u) => money(u.val, u.currency));

    /*
     * Growth from two filed revenues, never from one.
     *
     * Both years are shown so the reader can check the arithmetic, and it is only
     * computed when the prior year comes from the same tag — comparing a figure filed
     * under one revenue concept against another is how a restatement becomes a trend.
     */
    const prior = priorAnnual(f, standard.name, standard.revenue, revenue);
    if (prior && prior.val > 0) {
      const pct = ((revenue.val - prior.val) / prior.val) * 100;
      profile.push({
        label: 'Revenue growth',
        value: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% — ${money(prior.val, prior.currency)} (FY ${prior.end}) to ${money(revenue.val, revenue.currency)} (FY ${revenue.end})`,
        sourceUrl: filingUrl(cik, revenue),
      });
    }
    add('Operating income', operating, (u) => money(u.val, u.currency));
    add('Net income', net, (u) => money(u.val, u.currency));

    // Two filed numbers divided, shown with both, rather than a ratio out of nowhere.
    if (operating && revenue.val > 0) {
      profile.push({
        label: 'Operating margin',
        value: `${((operating.val / revenue.val) * 100).toFixed(1)}% — ${money(operating.val, operating.currency)} on ${money(revenue.val, revenue.currency)}, FY ending ${revenue.end}`,
        sourceUrl: filingUrl(cik, revenue),
      });
    }

    // Deliberately not called market capitalisation: it is the non-affiliate holding.
    add('Public float', float, (u) => money(u.val, u.currency));
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
  if (refused.length) {
    // Named rather than counted: a refusal is usually right, and when it is not, the
    // line says which company to look at.
    console.log(`[edgar] ${refused.length} refused as ambiguous:`);
    for (const r of refused) console.log(`          ${r}`);
  }
  if (written === 0) {
    warn('Connected to EDGAR but wrote no profiles — the matcher found nothing it trusts.');
  }
  if (stale.length) {
    console.log(`[edgar] ${stale.length} skipped for stale figures:`);
    for (const s of stale) console.log(`          ${s}`);
  }
  process.exit(0);
}

await main();
