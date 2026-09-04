/**
 * Retrieval primitives.
 *
 * Pure functions, deliberately kept away from the database module: the static build
 * searches the same corpus in the browser, and two implementations of "which words
 * matter" would drift apart within a week. One copy, used by both.
 */

/**
 * Words that carry no retrieval signal but dominate a naive tsquery.
 *
 * Three groups, and all three matter:
 *
 *  - **Ordinary stopwords** — articles, prepositions, auxiliaries.
 *  - **Words addressed to the assistant** — "challenge", "explain", "brief me",
 *    "teach". These describe what the user wants *done*, not what they want it done
 *    about, and counting them as content drags query coverage down until an answerable
 *    question gets refused.
 *  - **Filler verbs and nouns of enquiry** — "happening", "going on", "latest",
 *    "update", "news". "What is happening with AI in retail?" was refused because
 *    *happening* appears in no source, which is both true and completely beside the
 *    point.
 */
export const QUESTION_NOISE = new RegExp(
  '\\b(' +
    [
      // articles, prepositions, auxiliaries, pronouns
      'a', 'an', 'the', 'of', 'in', 'on', 'at', 'by', 'as', 'for', 'to', 'from', 'into',
      'over', 'under', 'with', 'without', 'and', 'but', 'or', 'if', 'so', 'than', 'then',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did', 'done',
      'has', 'have', 'had', 'can', 'could', 'would', 'should', 'will', 'shall', 'may',
      'might', 'must', 'it', 'its', 'this', 'that', 'these', 'those', 'there', 'here',
      'they', 'them', 'their', 'we', 'us', 'our', 'you', 'your', 'me', 'my', 'i',
      // question words
      'what', 'which', 'who', 'whom', 'whose', 'when', 'where', 'why', 'how',
      // addressed to the assistant, not to the corpus
      'tell', 'explain', 'brief', 'teach', 'prepare', 'challenge', 'claim', 'claims',
      'show', 'give', 'find', 'help', 'please', 'summarise', 'summarize', 'describe',
      // filler verbs and nouns of enquiry
      'happening', 'happened', 'happen', 'going', 'doing', 'saying', 'looking',
      'know', 'knows', 'think', 'thinks', 'need', 'needs', 'want', 'wants',
      'latest', 'recent', 'recently', 'current', 'currently', 'news', 'update',
      'updates', 'anything', 'something', 'everything', 'more', 'most', 'less',
      'any', 'all', 'some', 'new', 'now', 'today', 'next', 'about', 'around',
      'beyond', 'across', 'within', 'between', 'against', 'towards', 'toward',
    ].join('|') +
    ')\\b',
  'gi',
);

/**
 * Terms shorter than the usual floor that are worth keeping.
 *
 * The length filter exists to drop noise, but it also silently removed "AI" — the single
 * most frequent meaningful term in this corpus — so a question about AI retrieved on its
 * other words only. Two-letter acronyms are content, not noise.
 */
export const SHORT_TERMS_WORTH_KEEPING = new Set([
  'ai', 'ml', 'ar', 'vr', 'xr', 'hr', 'eu', 'uk', 'ev', 'iot',
  '5g', '6g', 'bi', 'ux', 'ui', 'kpi', 'roi', 'esg', 'llm', 'nlp', 'api', 'sku',
]);
// "IT" and "US" are deliberately absent: the noise filter strips them as pronouns before
// they get here, and the pronoun reading is far commoner than the acronym one. Losing
// "US" from "US retailers" costs less than admitting every "us" in every question.

/**
 * Turns a question into a tsquery input.
 *
 * The terms are joined with OR, not left space-separated. `websearch_to_tsquery`
 * treats spaces as AND, so a seven-word question requires all seven stems to appear in
 * one claim and matches essentially nothing — which the engine then reports, correctly
 * but uselessly, as "insufficient evidence". OR retrieves candidates and `ts_rank`
 * sorts them, so claims matching more terms still come first.
 */
export function queryTerms(question: string): string[] {
  return question
    .replace(QUESTION_NOISE, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => {
      const lower = w.toLowerCase();
      // Drop the tsquery operator keywords, which would be parsed as syntax.
      if (['and', 'not', 'or'].includes(lower)) return false;
      return w.length > 2 || SHORT_TERMS_WORTH_KEEPING.has(lower);
    })
    .slice(0, 12);
}

export const COVERAGE_THRESHOLD = 0.7;

export interface CoverageAssessment {
  covered: string[];
  missing: string[];
  ratio: number;
  sufficient: boolean;
}

/**
 * Reduces a word to a form that matches its own inflections.
 *
 * The previous rule sliced a fixed number of characters off the end, which fails on
 * ordinary English morphology: "scaling" became "scali" and so matched neither "scale"
 * nor "scaled", and "companies" became "compani" and so missed "company". Questions were
 * then refused for lacking evidence that was sitting right there.
 *
 * Stripping the suffix instead gives a stem that is a genuine prefix of every inflection:
 * scaling/scaled/scales/scale all reduce to "scal", companies/company to "compan".
 * Deliberately not a full Porter stemmer — these five rules cover what questions and
 * headlines actually differ by, and each additional rule is another way to be wrong.
 */
export function stemForMatch(word: string): string {
  const lower = word.toLowerCase();
  const strip = (suffix: string, min = 4): string | null => {
    if (!lower.endsWith(suffix)) return null;
    const stem = lower.slice(0, -suffix.length);
    return stem.length >= min ? stem : null;
  };
  return strip('ies') ?? strip('ing') ?? strip('ed') ?? strip('es') ?? strip('s') ?? lower;
}

export function assessCoverage(terms: string[], texts: string[]): CoverageAssessment {
  if (terms.length === 0) {
    return { covered: [], missing: [], ratio: 1, sufficient: true };
  }
  const haystack = texts.join(' \n ').toLowerCase();
  const covered: string[] = [];
  const missing: string[] = [];
  for (const term of terms) {
    (haystack.includes(stemForMatch(term)) ? covered : missing).push(term);
  }
  const ratio = covered.length / terms.length;
  return { covered, missing, ratio, sufficient: ratio >= COVERAGE_THRESHOLD };
}
