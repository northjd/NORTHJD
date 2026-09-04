/**
 * Search.
 *
 * The implemented path is PostgreSQL full-text search, used directly by the pages that
 * need it (`/search`, and claim retrieval in the Companion). This module holds the
 * shared query parsing and the interface semantic retrieval will implement.
 */

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
