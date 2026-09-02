/**
 * RSS / Atom parsing.
 *
 * Feeds are the one ingestion channel publishers explicitly build for machines, which
 * is why the MVP's real connector is a feed connector rather than a scraper. We take
 * only what the feed offers: we never follow the item link to pull an article body,
 * because that would be scraping under a different name and is not covered by
 * publishing a feed.
 */

import { XMLParser } from 'fast-xml-parser';
import { htmlToText, parseDateOrNull, truncate } from '@mios/domain';

export interface FeedItem {
  externalId: string | null;
  title: string;
  link: string;
  /** Feed-provided summary or content, converted to plain text. */
  summary: string;
  author: string | null;
  publishedAt: Date | null;
  updatedAt: Date | null;
  categories: string[];
}

export interface ParsedFeed {
  title: string;
  homepageUrl: string;
  items: FeedItem[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  trimValues: true,
  parseTagValue: false,
  processEntities: true,
  // A feed with one <item> must still parse as a list.
  isArray: (name) => ['item', 'entry', 'category', 'link'].includes(name),
});

type Node = Record<string, unknown>;

const asNode = (v: unknown): Node | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Node) : null;

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined ? [] : [v]);

/** Feed values are sometimes `"text"`, sometimes `{ "#text": "text", "@type": … }`. */
function textOf(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  const node = asNode(v);
  if (node) {
    const t = node['#text'];
    if (typeof t === 'string') return t;
    if (typeof t === 'number') return String(t);
  }
  return '';
}

/**
 * Extracts a link from either dialect.
 *
 * `link` is forced to an array by the parser so Atom's multiple typed links survive,
 * which means RSS's plain `<link>text</link>` also arrives wrapped. Both shapes are
 * handled here; getting this wrong silently drops every item in an RSS feed.
 */
function linkOf(node: Node): string {
  for (const raw of asArray(node['link'])) {
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    const child = asNode(raw);
    if (!child) continue;

    const href = String(child['@href'] ?? '').trim();
    if (href) {
      const rel = String(child['@rel'] ?? 'alternate');
      if (rel === 'alternate' || rel === '') return href;
      continue;
    }
    const text = textOf(child).trim();
    if (text) return text;
  }
  // Atom feeds with only rel="self"/"edit" links: take the first href we saw.
  for (const raw of asArray(node['link'])) {
    const child = asNode(raw);
    const href = child ? String(child['@href'] ?? '').trim() : '';
    if (href) return href;
  }
  return '';
}

function categoriesOf(node: Node): string[] {
  return asArray(node['category'])
    .map((c) => {
      const n = asNode(c);
      return n ? String(n['@term'] ?? textOf(n)) : textOf(c);
    })
    .filter((s) => s.length > 0 && s.length < 100);
}

export class FeedParseError extends Error {}

export function parseFeed(xml: string, baseUrl: string): ParsedFeed {
  let doc: Node;
  try {
    doc = parser.parse(xml) as Node;
  } catch (err) {
    throw new FeedParseError(`XML parse failed: ${err instanceof Error ? err.message : err}`);
  }

  const rss = asNode(doc['rss']);
  const rdf = asNode(doc['rdf:RDF']);
  const feed = asNode(doc['feed']);

  if (rss || rdf) {
    const channel = asNode(rss?.['channel']) ?? asNode(rdf?.['channel']) ?? {};
    // RSS 1.0 puts items as siblings of <channel>, RSS 2.0 inside it.
    const rawItems = [...asArray(channel['item']), ...asArray(rdf?.['item'])];

    const items = rawItems
      .map((raw) => {
        const item = asNode(raw);
        if (!item) return null;
        const link = linkOf(item);
        const title = htmlToText(textOf(item['title']));
        if (!title || !link) return null;

        const body =
          textOf(item['content:encoded']) || textOf(item['description']) || textOf(item['summary']);

        return {
          externalId: textOf(item['guid']) || link || null,
          title,
          link,
          summary: truncate(htmlToText(body), 4000),
          author: htmlToText(textOf(item['dc:creator']) || textOf(item['author'])) || null,
          publishedAt: parseDateOrNull(textOf(item['pubDate']) || textOf(item['dc:date'])),
          updatedAt: parseDateOrNull(textOf(item['atom:updated'])),
          categories: categoriesOf(item),
        } satisfies FeedItem;
      })
      .filter((i): i is FeedItem => i !== null);

    return {
      title: htmlToText(textOf(channel['title'])) || baseUrl,
      homepageUrl: linkOf(channel) || baseUrl,
      items,
    };
  }

  if (feed) {
    const items = asArray(feed['entry'])
      .map((raw) => {
        const entry = asNode(raw);
        if (!entry) return null;
        const link = linkOf(entry);
        const title = htmlToText(textOf(entry['title']));
        if (!title || !link) return null;

        const body = textOf(entry['content']) || textOf(entry['summary']);
        const authorNode = asNode(entry['author']);

        return {
          externalId: textOf(entry['id']) || link || null,
          title,
          link,
          summary: truncate(htmlToText(body), 4000),
          author: authorNode ? htmlToText(textOf(authorNode['name'])) || null : null,
          publishedAt: parseDateOrNull(textOf(entry['published']) || textOf(entry['updated'])),
          updatedAt: parseDateOrNull(textOf(entry['updated'])),
          categories: categoriesOf(entry),
        } satisfies FeedItem;
      })
      .filter((i): i is FeedItem => i !== null);

    return {
      title: htmlToText(textOf(feed['title'])) || baseUrl,
      homepageUrl: linkOf(feed) || baseUrl,
      items,
    };
  }

  throw new FeedParseError('Document is neither RSS nor Atom');
}
