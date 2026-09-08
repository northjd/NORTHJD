/**
 * Multilingual full-text search.
 *
 * The corpus is 84% English and the rest German, Dutch, Danish, Norwegian and Finnish.
 * Every row used to be indexed with the `english` configuration, so word endings in
 * those languages did not stem and a German query for "Übernahme" missed every article
 * about "Übernahmen". These cover the query-side half of the fix; the indexing half is
 * asserted against the real database in the integration suite, because it is a property
 * of the generated column rather than of any function here.
 */

import { describe, expect, it } from 'vitest';
import {
  SEARCH_CONFIGS,
  configForLanguage,
  matchesQuery,
  multilingualTsQuery,
  rankQuery,
  unsupportedLanguages,
} from '@mios/search';
import { sql, type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

/** The SQL PostgreSQL would actually receive, parameters left as placeholders. */
const dialect = new PgDialect();
const render = (fragment: SQL): string => dialect.sqlToQuery(fragment).sql;

describe('language to configuration', () => {
  it('maps the languages the source registry publishes in', () => {
    expect(configForLanguage('de')).toBe('german');
    expect(configForLanguage('nl')).toBe('dutch');
    expect(configForLanguage('da')).toBe('danish');
    expect(configForLanguage('no')).toBe('norwegian');
    expect(configForLanguage('sv')).toBe('swedish');
    expect(configForLanguage('fi')).toBe('finnish');
    expect(configForLanguage('en')).toBe('english');
  });

  it('treats the Norwegian written standards as one configuration', () => {
    // Sources declare nb or nn as often as no, and Snowball has a single stemmer.
    expect(configForLanguage('nb')).toBe('norwegian');
    expect(configForLanguage('nn')).toBe('norwegian');
  });

  it('falls back to English rather than failing on an unknown code', () => {
    // A source registered in a language nobody mapped should still be searchable by
    // company name, which is what the fallback preserves.
    expect(configForLanguage('ja')).toBe('english');
    expect(configForLanguage(null)).toBe('english');
    expect(configForLanguage(undefined)).toBe('english');
  });

  it('is case-insensitive, because feeds declare DE as readily as de', () => {
    expect(configForLanguage('DE')).toBe('german');
  });
});

describe('unsupportedLanguages', () => {
  it('is empty for the languages currently registered', () => {
    expect(unsupportedLanguages(['en', 'de', 'nl', 'da', 'no', 'sv', 'fi'])).toEqual([]);
  });

  it('names a language whose configuration is not in the query list', () => {
    // French is in the map but deliberately not in SEARCH_CONFIGS: nothing publishes in
    // it yet, and querying through a configuration no row uses is pure cost. Registering
    // a French source should therefore fail the integration check, not pass quietly.
    expect(unsupportedLanguages(['fr'])).toEqual(['fr']);
  });

  it('ignores nulls, which is what a feed with no language declaration gives us', () => {
    expect(unsupportedLanguages([null, 'en'])).toEqual([]);
  });
});

describe('multilingualTsQuery', () => {
  it('produces one branch per configuration, OR-ed', () => {
    const rendered = render(multilingualTsQuery('Übernahme'));
    for (const cfg of SEARCH_CONFIGS) expect(rendered).toContain(`'${cfg}'`);
    // Six separators for seven branches.
    expect(rendered.split(' || ').length).toBe(SEARCH_CONFIGS.length);
  });

  it('uses the parser the caller asked for', () => {
    expect(render(multilingualTsQuery('x', 'websearch'))).toContain('websearch_to_tsquery');
    expect(render(multilingualTsQuery('x', 'plainto'))).toContain('plainto_tsquery');
    // `raw` is for queries already in tsquery syntax, such as the `a | b` form the
    // coverage lookup assembles by hand.
    expect(render(multilingualTsQuery('a | b', 'raw'))).toContain('to_tsquery');
  });

  it('never interpolates the query text into the SQL', () => {
    // The whole list is built with sql.raw for the configuration names only. If a query
    // string ever reached sql.raw, a search for "'" would be an injection.
    const rendered = render(multilingualTsQuery("'; drop table claims; --"));
    expect(rendered).not.toContain('drop table');
  });
});

describe('matchesQuery and rankQuery', () => {
  it('wrap the OR-ed query so operator precedence cannot split it', () => {
    // `v @@ a || b` parses as `v @@ (a || b)` only by luck of precedence; the
    // parenthesis is what makes it true by construction.
    const rendered = render(matchesQuery(sql.raw('e.search_vector'), 'x'));
    expect(rendered).toContain('@@ (');
  });

  it('ranks against the same query it matches on', () => {
    const rendered = render(rankQuery(sql.raw('e.search_vector'), 'x'));
    expect(rendered).toContain('ts_rank(');
    for (const cfg of SEARCH_CONFIGS) expect(rendered).toContain(`'${cfg}'`);
  });
});
