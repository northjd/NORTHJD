/**
 * Deciding whether an SEC filer is the company we think it is.
 *
 * Extracted from the fetch script so the six historical mis-attributions can be held as
 * tests. They were not hypothetical: before any name check existed, matching on ticker
 * alone gave Ahold Delhaize the accounts of Array Digital Infrastructure, Danone those
 * of Brookfield, LVMH those of Moelis, and Richemont, L'Oréal and Telstra the same
 * treatment — because a ticker is unique to an exchange and not to the world. Each
 * produced a plausible revenue figure for the wrong company, which is the worst thing
 * this product can do, and none of them looks wrong on the page.
 *
 * Three things decide, in order:
 *
 *   1. **The name**, after folding diacritics, dropping apostrophes and removing the
 *      legal form. "Amazon" is "AMAZON COM INC"; "Novo Nordisk" is "NOVO NORDISK A S".
 *   2. **The legal form**, which is evidence rather than noise. Metro AG is a German
 *      wholesaler and METRO INC. a Canadian grocer; they share a name and nothing else.
 *      Two forms that disagree mean two companies.
 *   3. **The ticker**, allowed to confirm a name relationship — never to create one.
 */

export interface Filer {
  cik_str: number;
  ticker: string;
  title: string;
}

/** Legal forms, folded to the jurisdiction they imply. */
const JURISDICTION: Record<string, string> = {
  inc: 'us',
  corp: 'us',
  corporation: 'us',
  co: 'us',
  company: 'us',
  companies: 'us',
  llc: 'us',
  lp: 'us',
  plc: 'uk',
  ltd: 'uk',
  limited: 'uk',
  ag: 'de',
  gmbh: 'de',
  kgaa: 'de',
  nv: 'nl',
  bv: 'nl',
  sa: 'fr',
  sas: 'fr',
  sarl: 'fr',
  as: 'scandinavian',
  asa: 'scandinavian',
  ab: 'nordic',
  oy: 'nordic',
  oyj: 'nordic',
  spa: 'it',
  srl: 'it',
  se: 'european',
};

/** Words that identify no one: depositary-receipt plumbing and grammatical filler. */
const FILLER = new Set([
  'com',
  'adr',
  'ads',
  'sponsored',
  'unsponsored',
  'the',
  'de',
  'group',
  // "Royal", granted by the Dutch crown and carried in the registered name. It is an
  // honorific rather than an identifier, and dropping it is what lets Ahold Delhaize
  // and Philips meet "Koninklijke Ahold Delhaize N.V." and "Koninklijke Philips N.V."
  'koninklijke',
]);

/**
 * "Holding" is not filler. It is usually a different company.
 *
 * Dropping it silently matched our Nestlé — the Swiss parent — to NESTLE HOLDINGS, INC.,
 * a US financing subsidiary, and our Heineken to Heineken Holding N.V. rather than
 * Heineken N.V. Both would have published one company's revenue under another's name,
 * which is the failure the whole matcher exists to prevent.
 *
 * So it comes out of the key like a legal form, but is remembered: when only one side
 * carries it, the names are not the same name, and a ticker has to say otherwise. That
 * keeps On → On Holding AG, where ONON agrees on both sides, and refuses the two above,
 * where nothing does.
 */
const HOLDING = new Set(['holding', 'holdings', 'holdingselskab', 'beteiligungen']);

export interface ParsedName {
  /** What identifies the company. */
  key: string;
  /** What only says where it is registered. */
  forms: Set<string>;
  /** Whether the name called itself a holding company. See HOLDING. */
  isHolding: boolean;
}

/**
 * A name split into identity and registration.
 *
 * "N.V." and "P.L.C." arrive as runs of single letters once punctuation is stripped, so
 * those are glued back together before legal forms are recognised — otherwise each one
 * silently became three meaningless one-letter tokens and Adyen N.V. never matched
 * Adyen.
 */
export function parseCompanyName(raw: string | null | undefined): ParsedName {
  // The ESEF index carries 36 entities with a null name. A registry is allowed to have
  // holes in it; a matcher that throws on one is not.
  if (!raw) return { key: '', forms: new Set(), isHolding: false };

  const words = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const glued: string[] = [];
  for (const word of words) {
    const previous = glued.at(-1);
    if (word.length === 1 && previous && previous.length <= 2 && /^[a-z]{1,2}$/.test(previous)) {
      glued[glued.length - 1] = previous + word;
    } else {
      glued.push(word);
    }
  }

  const forms = new Set<string>();
  const kept: string[] = [];
  let isHolding = false;
  for (const word of glued) {
    const form = JURISDICTION[word];
    if (form) forms.add(form);
    else if (HOLDING.has(word)) isHolding = true;
    else if (!FILLER.has(word) && word.length > 1) kept.push(word);
  }
  return { key: kept.join(' '), forms, isHolding };
}

/** Share-class and depositary suffixes: ERIC-B and ERIC are one listing family. */
export function normaliseTicker(ticker: string): string {
  return ticker.toUpperCase().replace(/[.\-\s].*$/, '');
}

/** Absent on either side is not a disagreement; two different forms is. */
export function formsAgree(a: Set<string>, b: Set<string>): boolean {
  return a.size === 0 || b.size === 0 || [...a].some((form) => b.has(form));
}

export interface Resolution {
  filer: Filer | null;
  /** Why, for the log — a refusal is usually right, and when it is not this says who. */
  reason: 'exact' | 'exact-by-ticker' | 'contained' | 'contained-by-ticker' | 'ambiguous' | 'none';
  detail?: string;
}

export function buildIndex(filers: readonly Filer[]) {
  const named = filers.map((f) => ({ ...f, ...parseCompanyName(f.title) }));
  const byName = new Map<string, typeof named>();
  for (const filer of named) {
    const bucket = byName.get(filer.key) ?? [];
    bucket.push(filer);
    byName.set(filer.key, bucket);
  }
  return { named, byName };
}

export function resolveFiler(
  index: ReturnType<typeof buildIndex>,
  entityName: string,
  entityTicker: string | null,
): Resolution {
  const { key, forms, isHolding } = parseCompanyName(entityName);
  if (key.length < 2) return { filer: null, reason: 'none' };
  const ticker = normaliseTicker(entityTicker ?? '');

  /**
   * One side calling itself a holding company and the other not is a disagreement.
   *
   * Only a real ticker overrides it. Two absent tickers are not an agreement — comparing
   * empty strings made every unticker'd name pass, which is exactly the case Nestlé is.
   */
  const holdingAgrees = (candidate: { isHolding: boolean; ticker: string }) =>
    candidate.isHolding === isHolding ||
    (ticker !== '' && normaliseTicker(candidate.ticker) === ticker);

  const sameName = (index.byName.get(key) ?? []).filter(
    (f) => formsAgree(forms, f.forms) && holdingAgrees(f),
  );

  if (sameName.length > 0) {
    const ciks = new Set(sameName.map((f) => f.cik_str));
    // Several ticker lines for one registrant — an ordinary share and its ADR — are one
    // company, and any of them resolves to the same filings.
    if (ciks.size === 1) return { filer: sameName[0]!, reason: 'exact' };
    // Genuinely different registrants sharing a name. The ticker may pick between them;
    // without it this refuses rather than guessing.
    const byTicker = sameName.find((f) => normaliseTicker(f.ticker) === ticker);
    if (byTicker) return { filer: byTicker, reason: 'exact-by-ticker' };
    return {
      filer: null,
      reason: 'ambiguous',
      detail: `${ciks.size} unrelated filers are called that and no ticker agrees`,
    };
  }

  /*
   * Containment, for a name that is a prefix of the registered one.
   *
   * Not on its own: "coca cola" is contained in both the bottler and the brand owner,
   * and the bottler was once handed the brand owner's $47.9bn against its own ~€10bn.
   * So it needs either near-equal length — a genuine variant differs by a suffix, not by
   * half the string — or an agreeing ticker.
   */
  const near = index.named.filter(
    (f) =>
      key.length >= 5 &&
      f.key.length >= 5 &&
      formsAgree(forms, f.forms) &&
      holdingAgrees(f) &&
      (f.key.includes(key) || key.includes(f.key)),
  );
  const byRatio = near.filter(
    (f) => Math.min(key.length, f.key.length) / Math.max(key.length, f.key.length) >= 0.75,
  );
  if (byRatio.length === 1) return { filer: byRatio[0]!, reason: 'contained' };

  const byTicker = ticker ? near.filter((f) => normaliseTicker(f.ticker) === ticker) : [];
  if (byTicker.length === 1) return { filer: byTicker[0]!, reason: 'contained-by-ticker' };

  // Several plausible names: the ticker breaks the tie, never makes it.
  const tie = byRatio.find((f) => normaliseTicker(f.ticker) === ticker);
  return tie ? { filer: tie, reason: 'contained-by-ticker' } : { filer: null, reason: 'none' };
}
