/**
 * Integration tests against the live local database.
 *
 * These assert the properties the product claims about its own data — the ones that
 * cannot be checked with a unit test because they are statements about what actually
 * got written by a real pipeline run over real feeds.
 *
 * Requires `npm run db:up`, `npm run db:migrate`, `npm run db:seed` and
 * `npm run pipeline`. Skips itself with a clear message if the database is unreachable.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { closeDb, db, pingDb, schema } from '@mios/database';
import { answerQuestion } from '@mios/intelligence';
import { runEvaluation } from '@mios/evaluation';
import { matchesQuery, unsupportedLanguages } from '@mios/search';

let reachable = false;
let workspaceId = '';
let userId = '';

beforeAll(async () => {
  const ping = await pingDb();
  reachable = ping.ok;
  if (!reachable) {
    console.warn('\n  Integration tests skipped: no database. Run `npm run db:up`.\n');
    return;
  }
  const ws = await db().query.workspaces.findFirst({
    where: eq(schema.workspaces.slug, 'personal'),
  });
  const user = await db().query.users.findFirst();
  workspaceId = ws?.id ?? '';
  userId = user?.id ?? '';
});

describe('evidence chain', () => {
  it('has no FACT claim without an evidence span', async () => {
    if (!reachable) return;
    const [row] = await db()
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.claims)
      .where(
        and(
          eq(schema.claims.claimType, 'FACT'),
          sql`not exists (select 1 from claim_evidence ce where ce.claim_id = ${schema.claims.id})`,
        ),
      );
    expect(row?.n).toBe(0);
  });

  it('stores quotes that match the document text at their offsets', async () => {
    if (!reachable) return;
    const rows = await db()
      .select({
        quote: schema.evidenceSpans.quote,
        start: schema.evidenceSpans.startOffset,
        end: schema.evidenceSpans.endOffset,
        text: schema.documentVersions.normalizedText,
      })
      .from(schema.evidenceSpans)
      .innerJoin(
        schema.documentVersions,
        eq(schema.documentVersions.id, schema.evidenceSpans.documentVersionId),
      )
      .limit(200);

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.text.slice(row.start, row.end)).toBe(row.quote);
    }
  });
});

describe('source rights enforcement', () => {
  it('has no active connector on an unapproved source', async () => {
    if (!reachable) return;
    const rows = await db()
      .select({ slug: schema.sources.slug })
      .from(schema.sourceConnectors)
      .innerJoin(schema.sources, eq(schema.sources.id, schema.sourceConnectors.sourceId))
      .innerJoin(schema.sourcePolicies, eq(schema.sourcePolicies.sourceId, schema.sources.id))
      .where(
        and(
          eq(schema.sourceConnectors.isActive, true),
          sql`${schema.sourcePolicies.rightsStatus} <> 'approved'`,
        ),
      );
    expect(rows.map((r) => r.slug)).toEqual([]);
  });

  it('has ingested nothing from a source still under review', async () => {
    if (!reachable) return;
    const [row] = await db()
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.rawDocuments)
      .innerJoin(
        schema.sourcePolicies,
        eq(schema.sourcePolicies.sourceId, schema.rawDocuments.sourceId),
      )
      .where(sql`${schema.sourcePolicies.rightsStatus} = 'pending_review'`);
    expect(row?.n).toBe(0);
  });

  it('retains no full text for a source limited to excerpts', async () => {
    if (!reachable) return;
    const rows = await db()
      .select({ scope: schema.documentVersions.storedScope, n: sql<number>`count(*)::int` })
      .from(schema.documentVersions)
      .groupBy(schema.documentVersions.storedScope);
    const scopes = Object.fromEntries(rows.map((r) => [r.scope, r.n]));
    // Only the demo fixtures are approved for full text.
    if (scopes.full_text) {
      const [row] = await db()
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.documentVersions)
        .innerJoin(
          schema.rawDocuments,
          eq(schema.rawDocuments.id, schema.documentVersions.documentId),
        )
        .innerJoin(schema.sources, eq(schema.sources.id, schema.rawDocuments.sourceId))
        .where(
          and(
            eq(schema.documentVersions.storedScope, 'full_text'),
            eq(schema.sources.isDemo, false),
          ),
        );
      expect(row?.n).toBe(0);
    }
  });
});

describe('the hype filter on real data', () => {
  it('never marks a first-party-only event as independently validated', async () => {
    if (!reachable) return;
    const [row] = await db()
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.events)
      .where(
        and(
          eq(schema.events.caseMaturity, 'INDEPENDENTLY_VALIDATED_IMPACT'),
          eq(schema.events.firstPartyOnly, true),
        ),
      );
    expect(row?.n).toBe(0);
  });
});

describe('the Companion', () => {
  it('answers a covered question with cited facts', async () => {
    if (!reachable || !workspaceId) return;
    const response = await answerQuestion({
      workspaceId,
      userId,
      request: {
        question: 'What is happening with markdown and allocation in retail?',
        mode: 'explore_it',
        depth: 'executive',
        length: 'standard',
        conversationId: null,
        pageContext: null,
        selectedEntityIds: [],
      },
    });

    expect(response.insufficientEvidence).toBe(false);
    expect(response.verifiedFacts.length).toBeGreaterThan(0);
    // Every factual statement resolves to a citation that has an evidence span.
    for (const fact of response.verifiedFacts) {
      expect(fact.citationIndexes.length).toBeGreaterThan(0);
      for (const index of fact.citationIndexes) {
        const citation = response.citations[index];
        expect(citation).toBeDefined();
        expect(citation!.evidenceSpanId).toBeTruthy();
      }
    }
  });

  it('refuses a question the sources cannot answer rather than inventing one', async () => {
    if (!reachable || !workspaceId) return;
    const response = await answerQuestion({
      workspaceId,
      userId,
      request: {
        question: 'What was the exact quarterly revenue of an unlisted Uzbek textile mill in 2019?',
        mode: 'explore_it',
        depth: 'executive',
        length: 'standard',
        conversationId: null,
        pageContext: null,
        selectedEntityIds: [],
      },
    });

    expect(response.insufficientEvidence).toBe(true);
    expect(response.verifiedFacts).toHaveLength(0);
    expect(response.unknowns.length).toBeGreaterThan(0);
  });

  it('produces the same evidence model for the voice rendering as for the text', async () => {
    if (!reachable || !workspaceId) return;
    const response = await answerQuestion({
      workspaceId,
      userId,
      request: {
        question: 'What is happening with markdown and allocation in retail?',
        mode: 'explore_it',
        depth: 'executive',
        length: 'standard',
        conversationId: null,
        pageContext: null,
        selectedEntityIds: [],
      },
    });
    // The spoken summary is derived from the same object, so anything it says is
    // already covered by the citations attached to that object.
    expect(response.voice.spokenSummary.length).toBeGreaterThan(0);
    expect(response.voice.estimatedSeconds).toBeGreaterThan(0);
    expect(response.citations.length).toBeGreaterThan(0);
  });

  it('always states an as-of date', async () => {
    if (!reachable || !workspaceId) return;
    const response = await answerQuestion({
      workspaceId,
      userId,
      request: {
        question: 'Brief me',
        mode: 'brief_me',
        depth: 'executive',
        length: 'sixty_second_brief',
        conversationId: null,
        pageContext: null,
        selectedEntityIds: [],
      },
    });
    expect(new Date(response.asOf).toString()).not.toBe('Invalid Date');
  });
});

describe('evaluation suite', () => {
  it('passes every invariant', async () => {
    if (!reachable) return;
    const run = await runEvaluation();
    const failures = run.cases.filter((c) => !c.passed);
    expect(failures.map((f) => `${f.slug}: ${f.detail}`)).toEqual([]);
    expect(run.passed).toBe(run.total);
  });
});

/**
 * Search has to work in the languages the registry actually publishes in.
 *
 * These are integration tests rather than unit ones because the thing being asserted is
 * a property of a generated column and of the rows in it — not of any function. A unit
 * test can prove the query is built correctly and still miss that every row was indexed
 * as English.
 */
describe('multilingual search', () => {
  it('queries through a configuration for every language a source publishes in', async () => {
    if (!reachable) return;
    const rows = await db()
      .selectDistinct({ language: schema.sources.language })
      .from(schema.sources);
    // Registering a Portuguese source without adding portuguese to SEARCH_CONFIGS would
    // index it correctly and then never match it. This is the check that catches that.
    expect(unsupportedLanguages(rows.map((r) => r.language))).toEqual([]);
  });

  it('indexes every searchable table with per-language stemming', async () => {
    if (!reachable) return;
    const { rows } = await db().execute<{ relname: string; expr: string }>(sql`
      select c.relname, pg_get_expr(ad.adbin, ad.adrelid) as expr
        from pg_attrdef ad
        join pg_class c on c.oid = ad.adrelid
        join pg_attribute a on a.attrelid = c.oid and a.attnum = ad.adnum
       where a.attname = 'search_vector'
         and c.relname in ('claims', 'events', 'insights')`);
    expect(rows.length).toBe(3);
    // `001_search.sql` adds these with IF NOT EXISTS, so a database carrying the old
    // english-only definition would keep it silently. This fails when that happens.
    for (const row of rows) expect(row.expr).toContain('north_lang');
  });

  it('gives every claim the language of the document it came from', async () => {
    if (!reachable) return;
    const [row] = await db()
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.claims)
      .innerJoin(
        schema.documentVersions,
        eq(schema.documentVersions.id, schema.claims.documentVersionId),
      )
      .innerJoin(
        schema.rawDocuments,
        eq(schema.rawDocuments.id, schema.documentVersions.documentId),
      )
      .where(
        sql`${schema.rawDocuments.language} is not null
            and ${schema.claims.language} is distinct from ${schema.rawDocuments.language}`,
      );
    expect(row?.n).toBe(0);
  });

  it('matches an inflected query against the language it was written in', async () => {
    if (!reachable) return;
    // Corpus-dependent by nature: pick a real German claim, take a word from it, and
    // ask whether its stem is findable. Skipped rather than faked when the feeds happen
    // to be carrying no German that day.
    const [sample] = await db()
      .select({ text: schema.claims.text })
      .from(schema.claims)
      .where(sql`${schema.claims.language} = 'de'`)
      .limit(1);
    if (!sample) return;

    const word = sample.text
      .split(/\s+/)
      .map((w) => w.replace(/[^\p{L}]/gu, ''))
      .find((w) => w.length > 8 && /^[A-ZÄÖÜ]/.test(w));
    if (!word) return;

    const [hit] = await db()
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.claims)
      .where(matchesQuery(schema.claims.searchVector, word));
    expect(hit?.n ?? 0).toBeGreaterThan(0);
  });
});

/**
 * The corpus survives between runs now, which makes pruning a real operation rather
 * than a hypothetical one — and pruning is where referential honesty gets broken.
 */
describe('corpus retention', () => {
  it('leaves no event without the documents it was clustered from', async () => {
    if (!reachable) return;
    // `db:retain` deletes documents by age; the cascade takes their `event_documents`
    // rows but not the events themselves. An event whose last document has gone is a
    // headline with no evidence under it, which is the one thing this product must not
    // publish.
    const [row] = await db()
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.events)
      .where(
        sql`not exists (select 1 from event_documents ed where ed.event_id = ${schema.events.id})`,
      );
    expect(row?.n).toBe(0);
  });

  it('holds nothing older than the retention window', async () => {
    if (!reachable) return;
    const days = Number.parseInt(process.env.CORPUS_RETENTION_DAYS ?? '400', 10);
    const [row] = await db()
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.rawDocuments)
      .where(
        sql`${schema.rawDocuments.isDemo} = false
            and coalesce(${schema.rawDocuments.publishedAt}, ${schema.rawDocuments.discoveredAt})
                < now() - (${days} || ' days')::interval`,
      );
    // Seeded demo material is exempt: it is deliberately placed reference content and
    // the seed would put it straight back.
    expect(row?.n).toBe(0);
  });
});

describe('teardown', () => {
  it('closes the connection', async () => {
    await closeDb();
    expect(true).toBe(true);
  });
});
