/**
 * Connector registry.
 *
 * A connector turns a configured source into `FetchedDocument`s. It does not decide
 * whether it is allowed to run — `evaluateRights` does that, and the pipeline calls it
 * before a connector is ever invoked.
 */

import { z } from 'zod';
import {
  type ConnectorResult,
  type ConnectorType,
  type FetchedDocument,
  htmlToText,
  truncate,
} from '@mios/domain';
import { FetchBlockedError, safeFetch } from './fetcher';
import { parseFeed } from './feed';

export * from './fetcher';
export * from './rights';
export * from './feed';

export interface ConnectorContext {
  sourceId: string;
  endpoint: string;
  cursor: string | null;
  configuration: Record<string, unknown>;
  /** Cap on items per run, so a first sync of a large archive stays bounded. */
  maxItems: number;
}

export interface Connector {
  readonly type: ConnectorType;
  readonly label: string;
  /** One line for the admin UI explaining what this connector does and does not do. */
  readonly description: string;
  run(ctx: ConnectorContext): Promise<ConnectorResult>;
}

// ── RSS / Atom ───────────────────────────────────────────────────────────────

const feedConnector: Connector = {
  type: 'rss',
  label: 'RSS / Atom feed',
  description:
    'Reads a publisher-provided feed. Stores only what the feed itself contains — it never follows the article link to retrieve a body.',

  async run(ctx: ConnectorContext): Promise<ConnectorResult> {
    const warnings: string[] = [];
    const res = await safeFetch(ctx.endpoint, { etag: ctx.cursor });

    if (res.status === 304) {
      return { documents: [], cursor: ctx.cursor, warnings: ['Feed unchanged since last sync (HTTP 304).'] };
    }

    const feed = parseFeed(res.body, res.finalUrl);
    const documents: FetchedDocument[] = [];

    for (const item of feed.items.slice(0, ctx.maxItems)) {
      let url: string;
      try {
        url = new URL(item.link, res.finalUrl).href;
      } catch {
        warnings.push(`Skipped item with unparseable link: ${truncate(item.title, 80)}`);
        continue;
      }

      documents.push({
        sourceId: ctx.sourceId,
        url,
        externalId: item.externalId,
        title: item.title,
        // The feed's own summary is the body. Anything more would be scraping.
        body: item.summary,
        excerpt: truncate(item.summary, 500),
        author: item.author,
        language: null,
        publishedAt: item.publishedAt,
        updatedAt: item.updatedAt,
        raw: { categories: item.categories, feedTitle: feed.title },
      });
    }

    if (documents.length === 0 && feed.items.length > 0) {
      warnings.push('Feed parsed but no item produced a usable document.');
    }

    return { documents, cursor: res.etag, warnings };
  },
};

// ── Manual URL ───────────────────────────────────────────────────────────────

/**
 * User-submitted single URL. The user asserting they may share a page is a different
 * basis from a publisher offering a feed, so this path stores an excerpt for
 * identification and records the submission in the audit log.
 */
const manualUrlConnector: Connector = {
  type: 'manual_url',
  label: 'Manual URL',
  description:
    'Ingests one page the user explicitly submitted. Extracts title and a short excerpt; does not crawl, follow links, or bypass any access control.',

  async run(ctx: ConnectorContext): Promise<ConnectorResult> {
    const url = String(ctx.configuration['url'] ?? ctx.endpoint);
    if (!url) return { documents: [], cursor: null, warnings: ['No URL supplied.'] };

    const res = await safeFetch(url, { accept: 'text/html,application/xhtml+xml' });
    const text = htmlToText(res.body);

    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(res.body);
    const ogTitle = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(res.body);
    const title = htmlToText(ogTitle?.[1] ?? titleMatch?.[1] ?? '') || url;

    const publishedMeta =
      /<meta[^>]+(?:property|name)=["'](?:article:published_time|datePublished|pubdate)["'][^>]+content=["']([^"']+)["']/i.exec(
        res.body,
      );

    return {
      documents: [
        {
          sourceId: ctx.sourceId,
          url: res.finalUrl,
          externalId: null,
          title: truncate(title, 300),
          body: text,
          excerpt: truncate(text, 500),
          author: null,
          language: null,
          publishedAt: publishedMeta?.[1] ? new Date(publishedMeta[1]) : null,
          updatedAt: null,
          raw: { contentType: res.contentType, bytes: res.bytes, submittedManually: true },
        },
      ],
      cursor: null,
      warnings: res.contentType.includes('html') ? [] : [`Unexpected content type: ${res.contentType}`],
    };
  },
};

// ── Demo ─────────────────────────────────────────────────────────────────────

const DemoDocSchema = z.object({
  title: z.string(),
  url: z.string(),
  body: z.string(),
  publishedAt: z.string(),
  author: z.string().optional(),
});

/**
 * Serves documents from the seed fixtures. Exists so the pipeline can be demonstrated
 * and tested offline and deterministically. Everything it produces is flagged
 * `isDemo`, which the UI renders as a visible badge on every derived item.
 */
const demoConnector: Connector = {
  type: 'demo',
  label: 'Demo fixtures',
  description:
    'Replays bundled fixture documents. Clearly-labelled demo data — every event, insight and citation derived from it carries a Demo badge.',

  async run(ctx: ConnectorContext): Promise<ConnectorResult> {
    const raw = ctx.configuration['documents'];
    const parsed = z.array(DemoDocSchema).safeParse(raw);
    if (!parsed.success) {
      return { documents: [], cursor: null, warnings: ['Demo connector has no valid fixtures configured.'] };
    }

    return {
      documents: parsed.data.slice(0, ctx.maxItems).map((d) => ({
        sourceId: ctx.sourceId,
        url: d.url,
        externalId: d.url,
        title: d.title,
        body: d.body,
        excerpt: truncate(d.body, 500),
        author: d.author ?? null,
        language: 'en',
        publishedAt: new Date(d.publishedAt),
        updatedAt: null,
        raw: { demo: true },
      })),
      cursor: null,
      warnings: [],
    };
  },
};

const REGISTRY = new Map<ConnectorType, Connector>([
  ['rss', feedConnector],
  ['atom', { ...feedConnector, type: 'atom' as const }],
  ['manual_url', manualUrlConnector],
  ['demo', demoConnector],
]);

export function getConnector(type: ConnectorType): Connector | null {
  return REGISTRY.get(type) ?? null;
}

export function listConnectors(): Connector[] {
  return [...new Set(REGISTRY.values())];
}

/**
 * Connector types that exist as an interface but are not implemented. Listed
 * explicitly so the admin surface can show them as "prepared, not implemented"
 * instead of leaving the reader to guess.
 */
export const UNIMPLEMENTED_CONNECTOR_TYPES: { type: ConnectorType; reason: string }[] = [
  { type: 'rest_api', reason: 'Interface defined; no source in the registry currently requires it.' },
  { type: 'graphql_api', reason: 'Interface defined; not needed by any registered source.' },
  { type: 'filing_api', reason: 'Planned for regulatory filings (e.g. EDGAR). Not implemented in this MVP.' },
  { type: 'licensed_feed', reason: 'Requires a commercial licence. Deliberately not implemented.' },
  { type: 'sitemap_discovery', reason: 'Only permissible per-source; no source approved for it.' },
  { type: 'structured_page', reason: 'Only permissible per-source; no source approved for it.' },
  { type: 'uploaded_document', reason: 'Planned. File upload handling is not implemented in this MVP.' },
  { type: 'webhook', reason: 'Planned for push sources. Not implemented.' },
  { type: 'mcp', reason: 'Future connector surface. Not implemented.' },
];

export { FetchBlockedError };
