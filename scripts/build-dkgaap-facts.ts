/**
 * Company financials from the Danish business register.
 *
 * The third register, and the only one that reaches a company nobody lists. EDGAR covers
 * SEC filers; ESEF covers issuers on an EU regulated market. Neither holds a private
 * European company, which is most of the ones this practice actually works for — and
 * Denmark is the exception, because Danish law requires every company to file annual
 * accounts publicly, whether or not anybody can buy its shares.
 *
 * Erhvervsstyrelsen publishes the filing index as an open Elasticsearch endpoint with no
 * key and no registration, and the accounts themselves as XBRL. Bestseller — private,
 * family-owned, DKK 38bn of revenue and 21,638 staff — is reachable this way and no
 * other.
 *
 * **Two warnings for whoever maintains this.**
 *
 * First, the consolidation rule is the *opposite* of the ESEF one. In an ESEF filing an
 * undimensioned fact is the group figure. Here an undimensioned fact is the **parent
 * company alone**: Bestseller's untagged revenue is DKK 20.6bn against a group figure of
 * DKK 38.1bn, and the group number is the one carrying
 * `cmn:ConsolidatedSoloDimension = cmn:ConsolidatedMember`. Reusing the ESEF logic here
 * would publish a real number describing the wrong company, quietly, and it would look
 * entirely plausible.
 *
 * Second, `distribution.virk.dk` and `regnskaber.virk.dk` are **HTTP only** — port 443
 * times out, it is not a redirect. These are public regulatory filings so there is
 * nothing confidential in transit, but there is no transport integrity either, and that
 * is worth knowing about a number this product presents as filed fact. Every figure
 * carries a link to the document it came from, so a reader can check it against the
 * register themselves, which is the same answer this product gives everywhere else.
 *
 * Which companies this looks at is deliberately narrow: only those with a
 * `registration_number` in the seed, hand-verified against the register. There is no
 * name matching here at all — a Danish CVR search would happily return a dormant holding
 * shell with the right name, and LEGO Holding A/S, which files three employees and no
 * revenue, is exactly what that looks like.
 */

import { XMLParser } from 'fast-xml-parser';
import { sql } from 'drizzle-orm';
import { db } from '@mios/database';

const INDEX = 'http://distribution.virk.dk/offentliggoerelser/_search';
const CONTACT = (process.env.SEC_CONTACT_EMAIL ?? '').trim();
const UA = `NORTH-MarketIntelligence/0.1 (${CONTACT || 'https://github.com/northjd/NORTHJD'})`;

const warn = (msg: string): void => {
  console.log(`::warning title=Danish register::${msg}`);
  console.error(`[dk] ${msg}`);
};

const GAP_MS = 400;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Filing {
  periodEnd: string;
  documentUrl: string;
}

/** The most recent annual reports for a CVR number, newest first. */
async function recentFilings(cvr: string): Promise<Filing[]> {
  const res = await fetch(INDEX, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: { term: { cvrNummer: Number(cvr) } },
      sort: [{ 'regnskab.regnskabsperiode.slutDato': { order: 'desc' } }],
      size: 4,
    }),
  });
  if (!res.ok) return [];
  const body = (await res.json()) as {
    hits?: {
      hits?: {
        _source: {
          regnskab?: { regnskabsperiode?: { slutDato?: string } };
          dokumenter?: { dokumentType: string; dokumentMimeType: string; dokumentUrl: string }[];
        };
      }[];
    };
  };
  const out: Filing[] = [];
  for (const hit of body.hits?.hits ?? []) {
    const periodEnd = hit._source.regnskab?.regnskabsperiode?.slutDato;
    // `application/xml` is the tagged instance. The xhtml and pdf renderings of the same
    // report are for reading, not for parsing.
    const doc = (hit._source.dokumenter ?? []).find(
      (d) => d.dokumentType === 'AARSRAPPORT' && d.dokumentMimeType === 'application/xml',
    );
    if (periodEnd && doc) out.push({ periodEnd, documentUrl: doc.dokumentUrl });
  }
  return out;
}

interface Fact {
  value: number;
  end: string;
  start: string;
  currency: string;
}

const CONSOLIDATED = 'cmn:ConsolidatedMember';
const SCOPE_AXIS = 'cmn:ConsolidatedSoloDimension';

const asArray = <T>(v: T | T[] | undefined): T[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];

/**
 * Parses a Danish XBRL instance into consolidated annual facts by concept.
 *
 * Contexts carry the period and the consolidation scope; facts point at a context and a
 * unit. Only contexts that are explicitly consolidated and carry no other dimension are
 * kept — an equity-class breakdown is still a breakdown, and Bestseller files several
 * `fsa:ProfitLoss` values under one.
 */
function parseInstance(xml: string): { facts: Map<string, Fact[]>; currency: string } {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const doc = parser.parse(xml) as Record<string, unknown>;
  const root = (doc['xbrli:xbrl'] ?? doc['xbrl']) as Record<string, unknown> | undefined;
  if (!root) return { facts: new Map(), currency: '' };

  const scopes = new Map<string, { start: string; end: string }>();
  for (const ctx of asArray(root['xbrli:context'] as Record<string, any>)) {
    const id = ctx['@_id'] as string | undefined;
    const period = ctx['xbrli:period'] as Record<string, string> | undefined;
    const start = period?.['xbrli:startDate'];
    const end = period?.['xbrli:endDate'];
    if (!id || !start || !end) continue;

    const members = asArray(
      ctx['xbrli:scenario']?.['xbrldi:explicitMember'] ??
        ctx['xbrli:segment']?.['xbrldi:explicitMember'],
    ) as Record<string, string>[];
    // Exactly one dimension, and it must be the consolidation axis set to the group.
    if (members.length !== 1) continue;
    const only = members[0]!;
    if (only['@_dimension'] !== SCOPE_AXIS) continue;
    if (String(only['#text'] ?? '') !== CONSOLIDATED) continue;
    scopes.set(id, { start, end });
  }

  const units = new Map<string, string>();
  for (const unit of asArray(root['xbrli:unit'] as Record<string, any>)) {
    const id = unit['@_id'] as string | undefined;
    const measure = unit['xbrli:measure'] as string | undefined;
    if (id && measure) units.set(id, measure.split(':').pop() ?? '');
  }

  const facts = new Map<string, Fact[]>();
  let currency = '';
  for (const [key, raw] of Object.entries(root)) {
    if (!key.startsWith('fsa:')) continue;
    for (const item of asArray(raw as Record<string, any>)) {
      if (typeof item !== 'object' || item === null) continue;
      const ctxId = item['@_contextRef'] as string | undefined;
      const scope = ctxId ? scopes.get(ctxId) : undefined;
      if (!scope) continue;
      const value = Number(item['#text']);
      if (!Number.isFinite(value)) continue;
      const unit = units.get(item['@_unitRef'] as string) ?? '';
      if (/^[A-Z]{3}$/.test(unit)) currency ||= unit;
      const list = facts.get(key) ?? [];
      list.push({ value, start: scope.start, end: scope.end, currency: unit });
      facts.set(key, list);
    }
  }
  return { facts, currency };
}

const DAYS = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Annual values for a concept, newest first, one per year. */
function annual(facts: Map<string, Fact[]>, concept: string): Fact[] {
  const rows = (facts.get(concept) ?? []).filter((f) => {
    const days = DAYS(f.start, f.end);
    return days >= 350 && days <= 380;
  });
  const byYear = new Map<string, Fact>();
  for (const row of rows) if (!byYear.has(row.end)) byYear.set(row.end, row);
  return [...byYear.values()].sort((a, b) => (a.end < b.end ? 1 : -1));
}

const SYMBOL: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', JPY: '¥' };

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

async function main(): Promise<void> {
  const entities = (
    await db().execute(sql`
      select id, name, registration_number as "registrationNumber", cik
        from entities
       where coalesce(registration_number, '') <> ''
       order by name`)
  ).rows as { id: string; name: string; registrationNumber: string; cik: string | null }[];

  if (entities.length === 0) {
    console.log('[dk] no company carries a registration number; nothing to fetch');
    process.exit(0);
  }

  let written = 0;
  for (const e of entities) {
    // A company filing with the SEC keeps those figures; see build-esef-facts.ts.
    if (e.cik) continue;

    await sleep(GAP_MS);
    const filings = await recentFilings(e.registrationNumber);
    if (filings.length === 0) {
      warn(`No annual report found for ${e.name} (CVR ${e.registrationNumber}).`);
      continue;
    }

    const ageYears = (Date.now() - Date.parse(filings[0]!.periodEnd)) / (365.25 * 86_400_000);
    if (ageYears > 3) {
      console.log(`[dk] ${e.name} skipped — latest filing is ${filings[0]!.periodEnd}`);
      continue;
    }

    let chosen: Filing | null = null;
    let revenue: Fact[] = [];
    let parsed: ReturnType<typeof parseInstance> | null = null;
    for (const filing of filings) {
      await sleep(GAP_MS);
      const res = await fetch(filing.documentUrl, { headers: { 'User-Agent': UA } });
      if (!res.ok) continue;
      const instance = parseInstance(await res.text());
      const series = annual(instance.facts, 'fsa:Revenue');
      if (series.length === 0) continue;
      chosen = filing;
      revenue = series;
      parsed = instance;
      break;
    }

    /*
     * Revenue may lawfully be absent, and that is not a failure to report.
     *
     * Danish company law lets some filers omit turnover from the published accounts.
     * LEGO A/S does: its instance carries two concepts, both headcount. Saying so beats
     * warning about a filing that is exactly as complete as the law requires.
     */
    if (!chosen || !parsed || revenue.length === 0) {
      console.log(`[dk] ${e.name}: filing carries no tagged revenue — nothing written`);
      continue;
    }

    const current = revenue[0]!;
    const sameYear = (concept: string) =>
      annual(parsed!.facts, concept).find(
        (f) => f.end === current.end && f.currency === current.currency,
      ) ?? null;
    const operating = sameYear('fsa:ProfitLossFromOrdinaryOperatingActivities');
    const net = sameYear('fsa:ProfitLoss');
    // Headcount is matched on the year alone. It has no currency — the unit is a plain
    // count — so requiring it to agree with the revenue's currency dropped every one.
    const staff =
      annual(parsed.facts, 'fsa:AverageNumberOfEmployees').find((f) => f.end === current.end) ??
      null;

    const profile: { label: string; value: string; sourceUrl: string }[] = [
      {
        label: 'Latest annual revenue',
        value: `${money(current.value, current.currency)} — FY ending ${current.end}`,
        sourceUrl: chosen.documentUrl,
      },
    ];

    const prior = revenue.find((f) => f.end < current.end && f.currency === current.currency);
    if (prior && prior.value > 0) {
      const pct = ((current.value - prior.value) / prior.value) * 100;
      profile.push({
        label: 'Revenue growth',
        value: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% — ${money(prior.value, prior.currency)} (FY ${prior.end}) to ${money(current.value, current.currency)} (FY ${current.end})`,
        sourceUrl: chosen.documentUrl,
      });
    }
    if (operating) {
      profile.push({
        label: 'Operating income',
        value: `${money(operating.value, operating.currency)} — FY ending ${operating.end}`,
        sourceUrl: chosen.documentUrl,
      });
      if (current.value > 0) {
        profile.push({
          label: 'Operating margin',
          value: `${((operating.value / current.value) * 100).toFixed(1)}% — ${money(operating.value, operating.currency)} on ${money(current.value, current.currency)}, FY ending ${current.end}`,
          sourceUrl: chosen.documentUrl,
        });
      }
    }
    if (net) {
      profile.push({
        label: 'Net income',
        value: `${money(net.value, net.currency)} — FY ending ${net.end}`,
        sourceUrl: chosen.documentUrl,
      });
    }
    // Denmark tags headcount, which neither EDGAR nor ESEF reliably does. It is an
    // average over the year, and is labelled as one.
    if (staff) {
      profile.push({
        label: 'Employees',
        value: `${Math.round(staff.value).toLocaleString('en-GB')} average over FY ending ${staff.end}`,
        sourceUrl: chosen.documentUrl,
      });
    }

    await db().execute(sql`
      update entities
         set public_profile = ${sql.param(JSON.stringify(profile))}::jsonb
       where id = ${sql.param(e.id)}
    `);
    written += 1;
    console.log(`[dk] ${e.name} · ${profile.length} figures · FY ${current.end}`);
  }

  console.log(`[dk] ${written} profiles written from ${entities.length} registered companies`);
  process.exit(0);
}

await main();
