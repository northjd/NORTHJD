/**
 * The EDGAR filer matcher, and the six wrong answers that shaped it.
 *
 * Every case in the first block actually happened. Before any name check existed the
 * script matched on ticker, and because a ticker is unique to an exchange rather than
 * to the world, six companies were given another company's revenue: numbers that looked
 * entirely plausible on the page and were about a different business. Nothing else this
 * product does is as damaging, so they are pinned here rather than described in a
 * comment.
 */

import { describe, expect, it } from 'vitest';
import {
  buildIndex,
  formsAgree,
  parseCompanyName,
  resolveFiler,
} from '../../scripts/lib/edgar-matching';

/** A slice of the real SEC index — titles and tickers exactly as EDGAR publishes them. */
const FILERS = [
  { cik_str: 1750, ticker: 'AIR', title: 'AAR CORP' },
  { cik_str: 1018724, ticker: 'AMZN', title: 'AMAZON COM INC' },
  { cik_str: 1959348, ticker: 'AD', title: 'Array Digital Infrastructure, Inc.' },
  { cik_str: 1001082, ticker: 'BN', title: 'Brookfield Corp' },
  { cik_str: 1596967, ticker: 'MC', title: 'Moelis & Co' },
  { cik_str: 39263, ticker: 'CFR', title: 'CULLEN FROST BANKERS, INC.' },
  { cik_str: 1698991, ticker: 'OR', title: 'OR Royalties Inc.' },
  { cik_str: 320017, ticker: 'TLS', title: 'Telos Corp' },
  { cik_str: 21344, ticker: 'KO', title: 'COCA COLA CO' },
  { cik_str: 1303523, ticker: 'BTI', title: 'British American Tobacco p.l.c.' },
  { cik_str: 1303523, ticker: 'BTAFF', title: 'British American Tobacco p.l.c.' },
  { cik_str: 353278, ticker: 'NVO', title: 'NOVO NORDISK A S' },
  { cik_str: 1605484, ticker: 'STLA', title: 'Stellantis N.V.' },
  { cik_str: 1321655, ticker: 'PLTR', title: 'Palantir Technologies Inc.' },
  { cik_str: 717826, ticker: 'ERIC', title: 'ERICSSON LM TELEPHONE CO' },
  { cik_str: 1113169, ticker: 'METRY', title: 'METRO INC./ADR' },
  { cik_str: 1858681, ticker: 'ONON', title: 'On Holding AG' },
  { cik_str: 1090727, ticker: 'UPS', title: 'UNITED PARCEL SERVICE INC' },
  { cik_str: 1868275, ticker: 'VBIO', title: 'Valion Bio, Inc.' },
  { cik_str: 883984, ticker: 'DEI', title: 'Douglas Emmett Inc' },
];

const index = buildIndex(FILERS);
const resolve = (name: string, ticker: string | null = null) =>
  resolveFiler(index, name, ticker).filer?.title ?? null;

describe('the six companies that were given the wrong accounts', () => {
  // Each pair shares a ticker and nothing else. The name must veto every one.
  it.each([
    ['Ahold Delhaize', 'AD'],
    ['Danone', 'BN'],
    ['LVMH', 'MC'],
    ['Richemont', 'CFR'],
    ["L'Oréal", 'OR'],
    ['Telstra', 'TLS'],
  ])('refuses a filer that only shares %s’s ticker', (name, ticker) => {
    expect(resolve(name, ticker)).toBeNull();
  });

  it('refuses the brand owner when asked about the bottler', () => {
    // Coca-Cola HBC is the bottler; matching it to COCA COLA CO handed it $47.9bn
    // against its own roughly €10bn.
    expect(resolve('Coca-Cola HBC', 'CCH')).toBeNull();
  });
});

describe('legal form is evidence, not noise', () => {
  it('does not confuse a German AG with a Canadian Inc', () => {
    // Metro AG wholesales in Düsseldorf; METRO INC. is a grocer in Montreal. Stripping
    // both suffixes without comparing them was what made them look identical.
    expect(resolve('Metro AG')).toBeNull();
  });

  it('accepts a form only one side states', () => {
    expect(resolve('Amazon', 'AMZN')).toBe('AMAZON COM INC');
    expect(resolve('Stellantis', 'STLA')).toBe('Stellantis N.V.');
    expect(resolve('Novo Nordisk', 'NOVO-B')).toBe('NOVO NORDISK A S');
    expect(resolve('On', 'ONON')).toBe('On Holding AG');
  });

  it('treats a form and its jurisdiction siblings as agreeing', () => {
    expect(formsAgree(new Set(['us']), new Set(['us']))).toBe(true);
    expect(formsAgree(new Set(['de']), new Set(['us']))).toBe(false);
    expect(formsAgree(new Set(), new Set(['us']))).toBe(true);
  });
});

describe('name parsing', () => {
  it('glues the single letters of N.V. and P.L.C. back into a legal form', () => {
    // Punctuation stripping turns "N.V." into "n v"; without gluing, Adyen N.V. parsed
    // as three tokens of noise and never matched Adyen.
    expect(parseCompanyName('Stellantis N.V.')).toEqual({
      key: 'stellantis',
      forms: new Set(['nl']),
    });
    expect(parseCompanyName('British American Tobacco p.l.c.')).toEqual({
      key: 'british american tobacco',
      forms: new Set(['uk']),
    });
    expect(parseCompanyName('NOVO NORDISK A S')).toEqual({
      key: 'novo nordisk',
      forms: new Set(['scandinavian']),
    });
  });

  it('drops depositary-receipt plumbing, which identifies nobody', () => {
    expect(parseCompanyName('Adyen N.V./ADR').key).toBe('adyen');
    expect(parseCompanyName('AMAZON COM INC').key).toBe('amazon');
  });

  it('folds diacritics so a French name matches an ASCII filing', () => {
    expect(parseCompanyName("L'Oréal").key).toBe('loreal');
    expect(parseCompanyName('Mondelēz International').key).toBe('mondelez international');
  });
});

describe('the ticker confirms a name, it never supplies one', () => {
  it('accepts a contained name when the ticker agrees', () => {
    // "palantir" is contained in "palantir technologies" and PLTR agrees on both sides.
    expect(resolve('Palantir', 'PLTR')).toBe('Palantir Technologies Inc.');
    // "ericsson" inside "ericsson lm telephone", with ERIC-B reduced to its family.
    expect(resolve('Ericsson', 'ERIC-B')).toBe('ERICSSON LM TELEPHONE CO');
  });

  it('refuses a contained name when nothing corroborates it', () => {
    // Douglas is a German perfumery chain; Douglas Emmett is a Los Angeles REIT.
    expect(resolve('Douglas')).toBeNull();
    // Valio is a Finnish dairy co-operative and files nowhere in the United States.
    expect(resolve('Valio')).toBeNull();
  });

  it('refuses a bare ticker match with no name overlap at all', () => {
    expect(resolve('Aviation Industries', 'AIR')).toBeNull();
  });
});

describe('several ticker lines for one registrant', () => {
  it('accepts them, because they resolve to the same filings', () => {
    // BTI and BTAFF are two lines on one CIK. Either answers for the company.
    expect(resolve('British American Tobacco', 'BATS')).toBe('British American Tobacco p.l.c.');
  });

  it('refuses when the same name belongs to different registrants', () => {
    const ambiguous = buildIndex([
      { cik_str: 1, ticker: 'AAA', title: 'Vega Industries Inc' },
      { cik_str: 2, ticker: 'BBB', title: 'Vega Industries Inc' },
    ]);
    expect(resolveFiler(ambiguous, 'Vega Industries', null).reason).toBe('ambiguous');
    // Given a ticker it can choose, and does.
    expect(resolveFiler(ambiguous, 'Vega Industries', 'BBB').filer?.cik_str).toBe(2);
  });
});
