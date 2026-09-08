/**
 * Search.
 *
 * The implemented path is PostgreSQL full-text search, used directly by the pages that
 * need it (`/search`, and claim retrieval in the Companion). This module holds the
 * shared query parsing and the interface semantic retrieval will implement.
 */

import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';

export interface SearchFilters {
  industrySlugs?: string[];
  topicSlugs?: string[];
  entityIds?: string[];
  perspectiveGroup?: string;
  maturities?: string[];
  evidenceStrengths?: string[];
  from?: Date;
  to?: Date;
}

export interface RetrievedItem {
  kind: 'event' | 'insight' | 'claim' | 'entity' | 'learning_unit';
  id: string;
  title: string;
  score: number;
}

export interface Retriever {
  readonly name: string;
  readonly available: boolean;
  retrieve(query: string, filters: SearchFilters, limit: number): Promise<RetrievedItem[]>;
}

/**
 * The text-search configurations a query is run through.
 *
 * Rows are indexed with the configuration for their own language (see
 * `packages/database/sql/002_search_language.sql`), which fixes the indexing half of
 * the problem and creates the querying half: a German row's lexemes are German-stemmed,
 * so an English-stemmed query will not find them.
 *
 * The answer is to OR the query across every configuration in use. It reads as though
 * it should produce cross-language noise and does not: a row can only match the
 * stemming that built it, so the German branch finds German rows, the English branch
 * finds English ones, and neither reaches into the other. Seven index scans on a GIN
 * index cost nothing at this corpus size.
 *
 * This list mirrors `north_lang` in the SQL, restricted to the languages the source
 * registry actually publishes in. `tests/integration/pipeline.test.ts` fails if a
 * source is registered in a language missing from here.
 */
export const SEARCH_CONFIGS = [
  'english',
  'german',
  'dutch',
  'danish',
  'norwegian',
  'swedish',
  'finnish',
] as const;

/** ISO code to PostgreSQL configuration, mirroring `north_lang`. */
const CONFIG_BY_CODE: Record<string, string> = {
  en: 'english',
  de: 'german',
  nl: 'dutch',
  da: 'danish',
  no: 'norwegian',
  nb: 'norwegian',
  nn: 'norwegian',
  sv: 'swedish',
  fi: 'finnish',
  fr: 'french',
  es: 'spanish',
  it: 'italian',
  pt: 'portuguese',
};

export function configForLanguage(code: string | null | undefined): string {
  return CONFIG_BY_CODE[(code ?? 'en').toLowerCase()] ?? 'english';
}

/** Which configurations a language is missing from — the check the test makes. */
export function unsupportedLanguages(codes: readonly (string | null)[]): string[] {
  return [
    ...new Set(
      codes
        .filter((c): c is string => Boolean(c))
        .filter((c) => !(SEARCH_CONFIGS as readonly string[]).includes(configForLanguage(c))),
    ),
  ];
}

type Parser = 'websearch' | 'plainto' | 'raw';

/**
 * One tsquery, stemmed every way the corpus is indexed, OR'd together.
 *
 * `raw` is for callers that have already assembled tsquery syntax — the `a | b | c`
 * form that entity search builds by hand. It is not an escape hatch for user input:
 * `to_tsquery` throws on a syntax error, which is why the other two parsers exist.
 */
export function multilingualTsQuery(query: string | SQLWrapper, parser: Parser = 'websearch'): SQL {
  const fn =
    parser === 'websearch'
      ? 'websearch_to_tsquery'
      : parser === 'plainto'
        ? 'plainto_tsquery'
        : 'to_tsquery';
  return sql.join(
    SEARCH_CONFIGS.map((cfg) => sql`${sql.raw(fn)}(${sql.raw(`'${cfg}'`)}, ${query})`),
    sql` || `,
  );
}

/** `search_vector @@ <query>`, across every configuration. */
export function matchesQuery(
  vector: SQLWrapper,
  query: string | SQLWrapper,
  parser: Parser = 'websearch',
): SQL {
  return sql`${vector} @@ (${multilingualTsQuery(query, parser)})`;
}

/**
 * `ts_rank` against the same OR'd query.
 *
 * Ranking an OR of stemmings sums the branches that hit, and only the row's own
 * language can hit, so the number is the rank under that row's configuration — which is
 * the comparison we want.
 */
export function rankQuery(
  vector: SQLWrapper,
  query: string | SQLWrapper,
  parser: Parser = 'websearch',
): SQL {
  return sql`ts_rank(${vector}, (${multilingualTsQuery(query, parser)}))`;
}

/**
 * Turns a natural-language question into a `websearch_to_tsquery` input by dropping
 * interrogatives and stopwords, which otherwise dominate the ranking.
 */
const QUESTION_NOISE =
  /\b(what|which|who|when|where|why|how|is|are|was|were|do|does|did|tell|me|about|please|can|you|the|a|an|of|in|on|for|to|with)\b/gi;

export function toTsQuery(question: string, maxTerms = 12): string {
  return question
    .replace(QUESTION_NOISE, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, maxTerms)
    .join(' ');
}

/**
 * Semantic retrieval is interface-only in this MVP: no embedding provider is
 * configured and pgvector is not enabled (see ADR 0001). This exists so the wiring is
 * in place, and it reports itself unavailable rather than silently degrading.
 */
export class SemanticRetriever implements Retriever {
  readonly name = 'semantic';
  readonly available = false;
  async retrieve(): Promise<RetrievedItem[]> {
    throw new Error(
      'Semantic retrieval is not configured. Set EMBEDDING_PROVIDER and enable pgvector.',
    );
  }
}
