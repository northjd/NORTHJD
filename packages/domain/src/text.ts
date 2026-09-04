/**
 * Text utilities used by extraction and evidence linking.
 *
 * Everything here is offset-preserving: an evidence span is a character range into a
 * stored document version, so any transformation that shifts offsets silently would
 * break the citation chain. Where normalisation is unavoidable it happens *once*, and
 * the normalised text is what gets stored and what offsets refer to.
 */

/** Sentence with its exact position in the source text. */
export interface Sentence {
  text: string;
  start: number;
  end: number;
}

const ABBREVIATIONS = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'sr',
  'jr',
  'st',
  'vs',
  'etc',
  'inc',
  'ltd',
  'co',
  'corp',
  'plc',
  'gmbh',
  'ag',
  'sa',
  'nv',
  'ab',
  'no',
  'fig',
  'approx',
  'e.g',
  'i.e',
  'u.s',
  'u.k',
  'q1',
  'q2',
  'q3',
  'q4',
]);

/**
 * Sentence splitter that keeps offsets. Not linguistically perfect — it is tuned to
 * avoid splitting inside "Inc." or "U.S." because a truncated evidence quote is worse
 * than an over-long one.
 */
export function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== '.' && ch !== '!' && ch !== '?' && ch !== '\n') continue;

    if (ch === '.') {
      const before = text.slice(Math.max(0, i - 12), i).toLowerCase();
      const lastWord = before.split(/[\s(]/).pop() ?? '';
      if (ABBREVIATIONS.has(lastWord)) continue;
      // "3.5" or "No. 4" — a digit on both sides is not a sentence end.
      if (/\d/.test(text[i - 1] ?? '') && /\d/.test(text[i + 1] ?? '')) continue;
    }

    let end = i + 1;
    while (end < text.length && /["')\]]/.test(text[end] ?? '')) end++;
    const next = text[end];
    if (ch !== '\n' && next && !/\s/.test(next)) continue;

    const raw = text.slice(start, end);
    if (raw.trim().length > 0) {
      const lead = raw.length - raw.trimStart().length;
      const trail = raw.length - raw.trimEnd().length;
      out.push({ text: raw.trim(), start: start + lead, end: end - trail });
    }
    start = end;
  }
  const tail = text.slice(start);
  if (tail.trim().length > 0) {
    const lead = tail.length - tail.trimStart().length;
    out.push({ text: tail.trim(), start: start + lead, end: text.length });
  }
  return out;
}

/** Collapses runs of whitespace but is only used on text we are *not* citing into. */
export function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Normalises raw HTML/feed text to the plain text we store and index. Runs exactly
 * once per document version; evidence offsets are computed against its output.
 */
export function normalizeText(input: string): string {
  return (
    input
      .replace(/\r\n?/g, '\n')
      // Escapes, not the literal characters: a non-breaking space and a zero-width joiner
      // are invisible in an editor, and a normaliser nobody can read is one nobody dares
      // change. u00a0 is NBSP; u200b\u2013u200d and ufeff are the zero-width set.
      .replace(/\u00a0/g, ' ')
      .replace(/[\u200b-\u200d\ufeff]/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

/** Minimal, allow-nothing HTML to text. We never render source HTML. */
export function htmlToText(html: string): string {
  return normalizeText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number.parseInt(d, 10)))
      .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCharCode(Number.parseInt(h, 16))),
  );
}

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'of',
  'to',
  'in',
  'on',
  'for',
  'with',
  'at',
  'by',
  'from',
  'as',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'it',
  'its',
  'that',
  'this',
  'these',
  'those',
  'will',
  'would',
  'has',
  'have',
  'had',
  'not',
  'no',
  'we',
  'our',
  'their',
  'they',
  'he',
  'she',
  'his',
  'her',
  'you',
  'your',
  'i',
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s&+-]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Jaccard similarity on token sets — used for near-duplicate detection. */
export function jaccard(a: string, b: string): number {
  const sa = new Set(tokenize(a));
  const sb = new Set(tokenize(b));
  if (sa.size === 0 || sb.size === 0) return 0;
  let shared = 0;
  for (const t of sa) if (sb.has(t)) shared++;
  return shared / (sa.size + sb.size - shared);
}

/**
 * Stable content fingerprint for exact-duplicate detection across sources. Based on
 * normalised tokens so that formatting differences do not defeat it.
 */
export function contentFingerprint(title: string, body: string): string {
  const tokens = tokenize(`${title} ${body.slice(0, 4000)}`)
    .slice(0, 200)
    .join(' ');
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < tokens.length; i++) {
    const c = tokens.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

/**
 * Does the text state a measurable outcome? Drives `quantified` and, through it, case
 * maturity.
 *
 * The percentage pattern deliberately has no trailing `\b`. A word boundary after `%`
 * never matches, because `%` is not a word character and neither is whatever follows
 * it — so `/\d+%\b/` silently fails on "markdown fell 18%", and every percentage
 * outcome was being classified as unquantified. Caught by a unit test; kept here as a
 * warning against re-adding it.
 */
export function containsQuantifiedOutcome(text: string): boolean {
  const percentage = /\d+(?:[.,]\d+)?\s?%/.test(text);
  const percentWord = /\b\d+(?:[.,]\d+)?\s?(?:percent|percentage points?|bps|basis points)\b/i.test(
    text,
  );
  const currency = /[€$£¥]\s?\d/.test(text);
  const magnitude = /\b\d+(?:[.,]\d+)?\s?(?:million|billion|trillion|bn|m|k)\b/i.test(text);
  const multiple = /\b\d+(?:[.,]\d+)?x\b/i.test(text);
  return percentage || percentWord || currency || magnitude || multiple;
}

/** Case-insensitive whole-word-ish search returning every match offset. */
export function findOccurrences(haystack: string, needle: string): number[] {
  if (!needle) return [];
  const out: number[] = [];
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  let idx = h.indexOf(n);
  while (idx !== -1) {
    const before = idx === 0 ? ' ' : (h[idx - 1] ?? ' ');
    const after = h[idx + n.length] ?? ' ';
    if (!/[\p{L}\p{N}]/u.test(before) && !/[\p{L}\p{N}]/u.test(after)) out.push(idx);
    idx = h.indexOf(n, idx + n.length);
  }
  return out;
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
