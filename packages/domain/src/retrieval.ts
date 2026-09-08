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
      'a',
      'an',
      'the',
      'of',
      'in',
      'on',
      'at',
      'by',
      'as',
      'for',
      'to',
      'from',
      'into',
      'over',
      'under',
      'with',
      'without',
      'and',
      'but',
      'or',
      'if',
      'so',
      'than',
      'then',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'do',
      'does',
      'did',
      'done',
      'has',
      'have',
      'had',
      'can',
      'could',
      'would',
      'should',
      'will',
      'shall',
      'may',
      'might',
      'must',
      'it',
      'its',
      'this',
      'that',
      'these',
      'those',
      'there',
      'here',
      'they',
      'them',
      'their',
      'we',
      'us',
      'our',
      'you',
      'your',
      'me',
      'my',
      'i',
      // question words
      'what',
      'which',
      'who',
      'whom',
      'whose',
      'when',
      'where',
      'why',
      'how',
      // addressed to the assistant, not to the corpus
      'tell',
      'explain',
      'brief',
      'teach',
      'prepare',
      'challenge',
      'claim',
      'claims',
      'show',
      'give',
      'find',
      'help',
      'please',
      'summarise',
      'summarize',
      'describe',
      // filler verbs and nouns of enquiry
      'happening',
      'happened',
      'happen',
      'going',
      'doing',
      'saying',
      'looking',
      'know',
      'knows',
      'think',
      'thinks',
      'need',
      'needs',
      'want',
      'wants',
      'latest',
      'recent',
      'recently',
      'current',
      'currently',
      'news',
      'update',
      'updates',
      'anything',
      'something',
      'everything',
      'more',
      'most',
      'less',
      'any',
      'all',
      'some',
      'new',
      'now',
      'today',
      'next',
      'about',
      'around',
      'beyond',
      'across',
      'within',
      'between',
      'against',
      'towards',
      'toward',
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
  'ai',
  'ml',
  'ar',
  'vr',
  'xr',
  'hr',
  'eu',
  'uk',
  'ev',
  'iot',
  '5g',
  '6g',
  'bi',
  'ux',
  'ui',
  'kpi',
  'roi',
  'esg',
  'llm',
  'nlp',
  'api',
  'sku',
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
      // Applied here rather than in QUESTION_NOISE: see NON_ENGLISH_STOPWORDS.
      if (NON_ENGLISH_STOPWORDS.has(lower)) return false;
      return w.length > 2 || SHORT_TERMS_WORTH_KEEPING.has(lower);
    })
    .slice(0, 12);
}

/**
 * Function words in the languages the registry publishes in, matched as whole tokens.
 *
 * Deliberately a Set rather than more entries in `QUESTION_NOISE`. That regex is built
 * without the unicode flag, so `\b` uses ASCII word characters: `\büber\b` never matches
 * "über" at all, because `Ü` is not a word character and the boundary assertion fails
 * before it starts. Half the list would have been silently inert.
 *
 * Measured need: of the terms a German question left uncovered, most were interrogatives
 * and auxiliaries — "Welche", "gab", "passiert", "werden". "Wie hoch ist der Mount
 * Everest?" scored 0.67 coverage on this corpus, made almost entirely of *ist* matching
 * inside "specialist" and *der* inside "under".
 *
 * Excluded on purpose, though they are common in German: `war`, `man`, `will`, `see`,
 * `rat`, `list`. Each is an ordinary English content word here, and dropping it from an
 * English question costs more than keeping it costs a German one.
 */
export const NON_ENGLISH_STOPWORDS = new Set([
  // German
  'welche',
  'welcher',
  'welches',
  'wie',
  'wo',
  'wer',
  'warum',
  'wieso',
  'wann',
  'was',
  'der',
  'die',
  'das',
  'den',
  'dem',
  'des',
  'ein',
  'eine',
  'einen',
  'einem',
  'eines',
  'einer',
  'und',
  'oder',
  'aber',
  'denn',
  'doch',
  'auch',
  'noch',
  'nur',
  'sehr',
  'mehr',
  'schon',
  'immer',
  'ist',
  'sind',
  'sein',
  'seine',
  'seinen',
  'waren',
  'wird',
  'werden',
  'wurde',
  'wurden',
  'hat',
  'haben',
  'hatte',
  'hatten',
  'kann',
  'können',
  'soll',
  'sollen',
  'muss',
  'müssen',
  'für',
  'mit',
  'von',
  'vom',
  'zum',
  'zur',
  'ins',
  'auf',
  'bei',
  'beim',
  'nach',
  'über',
  'unter',
  'sich',
  'sie',
  'ihr',
  'ihre',
  'nicht',
  'kein',
  'keine',
  'gibt',
  'gab',
  'passiert',
  'geht',
  'worden',
  'werde',
  'dass',
  'als',
  // Dutch
  'welke',
  'wat',
  'waar',
  'hoe',
  'waarom',
  'wanneer',
  'het',
  'deze',
  'dit',
  'dat',
  'zijn',
  'wordt',
  'worden',
  'werd',
  'heeft',
  'hebben',
  'had',
  'hadden',
  'kunnen',
  'moet',
  'moeten',
  'voor',
  'van',
  'naar',
  'over',
  'onder',
  'door',
  'uit',
  'niet',
  'ook',
  'nog',
  'maar',
  'omdat',
  'dan',
  'een',
  'aan',
  'bij',
  'zich',
  // Danish, Norwegian, Swedish
  'hvilke',
  'hvilken',
  'hvilket',
  'hvad',
  'hvor',
  'hvorfor',
  'hvem',
  'vilka',
  'vilken',
  'vilket',
  'vad',
  'hur',
  'varför',
  'när',
  'vem',
  'som',
  'och',
  'eller',
  'men',
  'inte',
  'ikke',
  'också',
  'også',
  'har',
  'have',
  'havde',
  'hade',
  'blir',
  'bliver',
  'blev',
  'kunne',
  'skal',
  'skulle',
  'til',
  'fra',
  'med',
  'på',
  'att',
  'det',
  'den',
  'ett',
  // Finnish
  'mitkä',
  'mikä',
  'miten',
  'miksi',
  'milloin',
  'kuka',
  'ovat',
  'olla',
  'oli',
  'olivat',
  'voi',
  'voidaan',
  'pitää',
  'mutta',
  'myös',
  'sekä',
  'joka',
  'jotka',
]);

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
  const stripper =
    (from: string) =>
    (suffix: string, min = 4): string | null => {
      if (!from.endsWith(suffix)) return null;
      const stem = from.slice(0, -suffix.length);
      return stem.length >= min ? stem : null;
    };

  const lower = word.toLowerCase();
  const en = stripper(lower);
  const english = en('ies') ?? en('ing') ?? en('ed') ?? en('es') ?? en('s') ?? lower;

  /*
   * Then Germanic and Nordic inflection, on the output of the English pass.
   *
   * Two passes rather than one, because a single list leaves inflections of the same
   * word on different rungs: `consumers` stops at the plural `s` and gives `consumer`,
   * while `consumer` runs on to `consum`, so a word stopped matching its own plural.
   * Running the second group over the first group's output settles both on `consum`.
   *
   * The groups must stay separate, though, and this is not fussiness. Applying all the
   * rules twice let `peruse` lose its `e` to give `perus` and then its `s` to give
   * `peru` — which is how "What is the capital of Peru?" scored full coverage against a
   * corpus of retail news. English plurals are stripped once, and only once.
   *
   * The floors are what keep these rules off short English words: `care` must not become
   * `car` and match `cars`, `other` must not become `oth`. Four for the bare `e`, which
   * `store`/`stores` needs; five for the rest, which is what separates `retail`/
   * `retailer` from `peru`/`peruse`.
   */
  const de = stripper(english);
  return de('erne', 5) ?? de('ene', 5) ?? de('en', 5) ?? de('er', 5) ?? de('e', 4) ?? english;
}

/**
 * The stems of every word in a text, for membership testing.
 *
 * Built once per text and reused across the query's terms. The alternative — a substring
 * scan per term — is what `String.includes` was doing, and it is both slower and wrong.
 */
export function textStems(text: string): Set<string> {
  return new Set((text.match(/[\p{L}\p{N}]+/gu) ?? []).map(stemForMatch));
}

/** Below this length a stem must match exactly; a four-letter prefix means nothing. */
const PREFIX_FLOOR = 5;
/** How much longer the other stem may be and still count as the same word. */
const PREFIX_SLACK = 2;

/**
 * Whether a term appears in a text, judged on words rather than characters.
 *
 * This replaces `haystack.includes(stem)`, which matched anywhere inside any word and
 * was therefore satisfied by coincidence. Measured on the live corpus: *Peru* matched
 * "peruse", *ist* matched "specialist" and "Minister" in 126 claims, *der* matched
 * "under" and "derided" in 179, *Mount* matched "amount" and "Paramount". "What is the
 * capital of Peru?" scored **1.00 coverage** and would have been answered — by a corpus
 * of retail news, on the strength of two substrings.
 *
 * That matters more here than anywhere else in the product, because `assessCoverage`
 * uses this to decide whether NORTH has evidence at all. A false match there is the
 * product asserting it can answer something it cannot, which is the failure it exists to
 * prevent.
 *
 * Both sides are stemmed and compared as whole words, with a bounded prefix tolerance so
 * that a stem may still meet a longer relative of itself — `retail` and `retailer`. Five
 * characters is the floor for that tolerance: it is what separates `retail`/`retailer`
 * from `peru`/`peruse`.
 */
export function termMatchesStems(term: string, stems: Set<string>): boolean {
  const stem = stemForMatch(term);
  if (stems.has(stem)) return true;
  if (stem.length < PREFIX_FLOOR) return false;
  for (const candidate of stems) {
    if (candidate.length < PREFIX_FLOOR) continue;
    const [shorter, longer] =
      candidate.length < stem.length ? [candidate, stem] : [stem, candidate];
    if (longer.length - shorter.length <= PREFIX_SLACK && longer.startsWith(shorter)) return true;
  }
  return false;
}

export function assessCoverage(terms: string[], texts: string[]): CoverageAssessment {
  if (terms.length === 0) {
    return { covered: [], missing: [], ratio: 1, sufficient: true };
  }
  const stems = new Set<string>();
  for (const text of texts) for (const stem of textStems(text)) stems.add(stem);

  const covered: string[] = [];
  const missing: string[] = [];
  for (const term of terms) {
    (termMatchesStems(term, stems) ? covered : missing).push(term);
  }
  const ratio = covered.length / terms.length;
  return { covered, missing, ratio, sufficient: ratio >= COVERAGE_THRESHOLD };
}
