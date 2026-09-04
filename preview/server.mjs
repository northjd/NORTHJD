/**
 * Interactive preview server.
 *
 * A standalone harness that talks to the live PGlite database over TCP. It exists
 * because corporate endpoint policy is blocking filesystem access to the repository,
 * so the real Next application cannot start — but the database needs no file access.
 *
 * IMPORTANT: this is a *preview harness*, not the product. The retrieval below
 * reimplements the Companion's logic (OR-joined tsquery, term-overlap relevance floor,
 * FACT-first ordering, citation to evidence spans) so the interaction can be
 * demonstrated. The authoritative implementations live in
 * packages/intelligence/src/companion.ts and packages/ranking/src/index.ts. Do not
 * treat this file as a source of truth, and delete it once the app runs again.
 *
 *   node server.mjs   →   http://127.0.0.1:4321
 */

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const PORT = 4321;
const pool = new pg.Pool({
  connectionString: 'postgres://postgres@127.0.0.1:55432/postgres',
  max: 1,
});
const q = async (sql, params = []) => (await pool.query(sql, params)).rows;

// ── Companion retrieval (mirrors packages/intelligence/src/companion.ts) ─────

/**
 * Words addressed to the assistant rather than describing the subject.
 *
 * Interrogatives were always stripped; imperatives must be too. "Challenge the claim
 * that AI allocation reduces markdown" is a question about allocation and markdown —
 * "challenge", "claim" and "that" are how the user is speaking to the Companion, and
 * counting them against coverage made a perfectly answerable question look
 * out-of-scope.
 */
const QUESTION_NOISE = new RegExp(
  '\\b(' +
    [
      // interrogatives and function words
      'what',
      'which',
      'who',
      'whom',
      'whose',
      'when',
      'where',
      'why',
      'how',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'do',
      'does',
      'did',
      'has',
      'have',
      'had',
      'the',
      'a',
      'an',
      'of',
      'in',
      'on',
      'for',
      'to',
      'with',
      'that',
      'this',
      'these',
      'those',
      'it',
      'its',
      'my',
      'me',
      'you',
      'your',
      'i',
      'we',
      'our',
      'their',
      'there',
      'any',
      'some',
      'more',
      'most',
      'much',
      'many',
      'about',
      'from',
      'into',
      'over',
      'please',
      'can',
      'could',
      'would',
      'should',
      'may',
      'might',
      'will',
      // imperatives directed at the assistant
      'tell',
      'show',
      'give',
      'explain',
      'describe',
      'summarise',
      'summarize',
      'brief',
      'prepare',
      'teach',
      'challenge',
      'compare',
      'analyse',
      'analyze',
      'list',
      'find',
      'search',
      'look',
      'help',
      'let',
      'make',
      'get',
      'know',
      'think',
      'consider',
      'assume',
      'claim',
      'claims',
      'question',
      'answer',
      'view',
      'take',
      'walk',
      'talk',
      'say',
      'said',
    ].join('|') +
    ')\\b',
  'gi',
);

const queryTerms = (question) =>
  question
    .replace(QUESTION_NOISE, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !['and', 'not', 'or'].includes(w.toLowerCase()))
    .slice(0, 12);

/**
 * Coverage gate.
 *
 * The question this answers is "do the monitored sources contain the vocabulary of
 * this question at all?" — measured as the share of query terms that appear anywhere
 * in the corpus.
 *
 * Measured on this corpus: every question the sources can answer scored 100%; every
 * question they cannot scored 25–60%. A term-overlap floor was tried first and was
 * wrong in both directions — it rejected "markdown rate" and "allocation proposals",
 * which are exactly the right claims, because a single sentence rarely contains two
 * distinct query concepts. `ts_rank` was also tried and cannot work: it is only
 * comparable within one query, and "population of Ulaanbaatar" out-ranked a retail
 * question the sources can genuinely answer.
 *
 * The nice property is that a refusal can now name the missing words, which is a
 * statement about coverage rather than about the question.
 */
const COVERAGE_THRESHOLD = 0.7;

async function queryCoverage(terms) {
  const missing = [];
  let present = 0;
  for (const term of terms) {
    const rows = await q(
      `select 1 from claims where search_vector @@ websearch_to_tsquery('english', $1) limit 1`,
      [term],
    );
    if (rows.length) present++;
    else missing.push(term);
  }
  return { coverage: terms.length ? present / terms.length : 0, missing };
}

const termOverlap = (text, terms) => {
  const hay = text.toLowerCase();
  return terms.filter((t) => hay.includes(t.toLowerCase().slice(0, Math.max(4, t.length - 2))))
    .length;
};

const FIRST_PARTY = (p) => String(p).startsWith('FIRST_PARTY');
const INDEPENDENT = new Set([
  'INDEPENDENT_BUSINESS_MEDIA',
  'INDUSTRY_MEDIA',
  'REGULATOR',
  'PUBLIC_INSTITUTION',
  'RESEARCH_INSTITUTION',
  'ACADEMIC_SOURCE',
  'LICENSED_PREMIUM',
]);

async function answer({ question, mode }) {
  const terms = queryTerms(question);
  const asOf = new Date();

  if (mode === 'capture_reflect') {
    return {
      mode,
      asOf,
      directAnswer:
        'Captured. This is stored as your own note, kept separate from verified source material — it will never be cited as evidence.',
      facts: [],
      interpretations: [question],
      hypotheses: [],
      counterEvidence: [],
      unknowns: [],
      starters: [],
      followUps: ['What should I investigate next on this?'],
      citations: [],
      insufficient: false,
    };
  }

  const tsquery = terms.join(' or ');
  const rows = tsquery
    ? await q(
        `select c.id, c.text, c.claim_type, c.quantified, c.evidence_strength,
                es.id span_id, es.quote, rd.title doc_title, rd.url doc_url,
                rd.published_at, s.name source_name, s.perspective,
                ts_rank(c.search_vector, websearch_to_tsquery('english', $1)) rank
         from claims c
         join document_versions dv on dv.id = c.document_version_id
         join raw_documents rd on rd.id = dv.document_id
         join sources s on s.id = c.source_id
         left join claim_evidence ce on ce.claim_id = c.id
         left join evidence_spans es on es.id = ce.evidence_span_id
         where c.search_vector @@ websearch_to_tsquery('english', $1)
         order by rd.published_at desc nulls last
         limit 40`,
        [tsquery],
      )
    : [];

  // Coverage gate first: if the sources do not contain the question's vocabulary, no
  // amount of per-claim filtering will produce a real answer.
  const { coverage, missing } = terms.length
    ? await queryCoverage(terms)
    : { coverage: 1, missing: [] };
  const covered = coverage >= COVERAGE_THRESHOLD;

  const priority = { FACT: 0, FORECAST: 1, INTERPRETATION: 2, UNVERIFIED_SIGNAL: 3 };
  const seen = new Set();
  const cited = !covered
    ? []
    : rows
        .filter((r) => r.span_id && !seen.has(r.id) && (seen.add(r.id), true))
        // One matched term is enough now — the coverage gate above does the real work.
        .filter((r) => terms.length === 0 || termOverlap(r.text, terms) >= 1)
        .sort(
          (a, b) =>
            (priority[a.claim_type] ?? 9) - (priority[b.claim_type] ?? 9) || b.rank - a.rank,
        )
        .slice(0, 10);

  // Mode-aware insufficiency, as in the real engine.
  let extra = { units: [], insights: [] };
  if (mode === 'explain_it' || mode === 'teach_me') {
    extra.units = tsquery
      ? await q(
          `select title, objective, explanation, structured_model, key_terms,
                  common_misconceptions, practical_questions, depth
           from learning_units
           where search_vector @@ websearch_to_tsquery('english', $1)
           order by ts_rank(search_vector, websearch_to_tsquery('english', $1)) desc
           limit 1`,
          [tsquery],
        )
      : [];
  }
  if (mode === 'brief_me') {
    extra.insights = await q(
      `select i.headline, i.takeaway, i.why_it_matters, e.case_maturity, e.first_party_only
       from insights i join events e on e.id = i.event_id
       where e.is_suppressed = false
       order by coalesce(e.event_at, e.first_reported_at) desc limit 5`,
    );
  }

  const needsClaims = mode === 'explore_it' || mode === 'prepare_me';
  const produced = cited.length > 0 || extra.units.length > 0 || extra.insights.length > 0;
  const insufficient = needsClaims ? cited.length === 0 : !produced;

  if (insufficient) {
    return {
      mode,
      asOf,
      directAnswer:
        'I do not have sufficient verified evidence in the monitored sources to answer this reliably. Rather than answer from general knowledge, here is what is missing.',
      facts: [],
      interpretations: [],
      hypotheses: [],
      counterEvidence: [],
      unknowns: [
        missing.length
          ? `No monitored source mentions: ${missing.slice(0, 6).join(', ')}.`
          : 'No stored claim or learning unit was relevant enough to this question.',
        `Only ${Math.round(coverage * 100)}% of this question's vocabulary appears anywhere in the monitored sources.`,
        'Adding a source, or ingesting a specific URL, would let me answer it.',
      ],
      starters: [],
      followUps: ['Which sources are currently monitored?'],
      citations: [],
      insufficient: true,
    };
  }

  const citations = cited.map((c) => ({
    claimId: c.id,
    sourceName: c.source_name,
    perspective: c.perspective,
    documentTitle: c.doc_title,
    sourceUrl: c.doc_url,
    publishedAt: c.published_at,
    evidenceStrength: c.evidence_strength,
    quote: c.quote,
  }));

  const facts = cited
    .filter((c) => c.claim_type === 'FACT')
    .map((c) => ({ text: c.text, citationIndexes: [cited.indexOf(c)] }));

  const firstPartyOnly = cited.length > 0 && cited.every((c) => FIRST_PARTY(c.perspective));
  const independentCount = new Set(
    cited.filter((c) => INDEPENDENT.has(c.perspective)).map((c) => c.source_name),
  ).size;

  const unknowns = [];
  if (firstPartyOnly)
    unknowns.push('Every source here is first-party. Nothing has been independently confirmed.');
  if (!cited.some((c) => c.quantified))
    unknowns.push('None of the retrieved claims states a quantified outcome.');
  unknowns.push(
    'Only the monitored sources were searched; developments outside them are not visible.',
  );

  const sourceCount = new Set(cited.map((c) => c.source_name)).size;
  const asOfLine = `As of ${asOf.toLocaleDateString('en-GB', { dateStyle: 'long' })}, based on ${cited.length} evidenced claim${cited.length === 1 ? '' : 's'} from ${sourceCount} source${sourceCount === 1 ? '' : 's'}.`;

  const contradictionRows = cited.length
    ? await q(`select explanation from contradictions where claim_a_id = any($1::uuid[]) limit 4`, [
        cited.map((c) => c.id),
      ])
    : [];

  const starters = cited.length
    ? await q(
        `select distinct ca.text from conversation_applications ca
         join event_claims ec on ec.event_id = ca.event_id
         where ec.claim_id = any($1::uuid[]) and ca.kind = 'conversation_starter'
         limit 5`,
        [cited.map((c) => c.id)],
      )
    : [];

  const base = {
    mode,
    asOf,
    citations,
    facts,
    counterEvidence: contradictionRows.map((c) => ({ text: c.explanation, citationIndexes: [] })),
    unknowns,
    starters: [],
    followUps: [],
    hypotheses: [],
    interpretations: [],
    insufficient: false,
  };

  switch (mode) {
    case 'brief_me':
      return {
        ...base,
        directAnswer: `${extra.insights.length} development${extra.insights.length === 1 ? '' : 's'} to know, as of ${asOf.toLocaleDateString('en-GB', { dateStyle: 'long' })}. Each links to its own evidence.`,
        interpretations: extra.insights.map((i) => `${i.headline} — ${i.takeaway}`),
        followUps: ['What changed on my watchlist this week?', 'Go deeper on the first item.'],
      };

    case 'explain_it':
    case 'teach_me': {
      const u = extra.units[0];
      return {
        ...base,
        directAnswer: u
          ? mode === 'teach_me'
            ? `Learning objective: ${u.objective}`
            : `${u.objective} ${u.explanation}`
          : `The monitored sources contain evidence on this, but no structured explainer exists for it yet. ${asOfLine}`,
        interpretations: u
          ? mode === 'teach_me'
            ? (u.key_terms ?? []).map((t) => `${t.term}: ${t.definition}`)
            : (u.structured_model ?? [])
                .flatMap((s) => s.points.map((p) => `${s.heading}: ${p}`))
                .slice(0, 6)
          : [],
        unknowns: u ? [...(u.common_misconceptions ?? []).slice(0, 2), ...unknowns] : unknowns,
        followUps: u ? (u.practical_questions ?? []).slice(0, 3) : [],
      };
    }

    case 'prepare_me':
      return {
        ...base,
        directAnswer: `Sixty-second brief. ${asOfLine}`,
        interpretations: [
          firstPartyOnly
            ? 'Treat this as the company’s own account of itself; it describes intent and self-reported results.'
            : `Independent sources are present (${independentCount}), which raises confidence that events occurred as described — not that they delivered the stated benefit.`,
        ],
        starters: starters.map((s) => s.text),
        followUps: ['What should I not raise in this meeting?', 'Give me one contrarian angle.'],
      };

    case 'challenge_me': {
      const assumptions = [];
      if (firstPartyOnly)
        assumptions.push(
          'Assumption: the company’s own description is accurate and complete. Nothing here tests that.',
        );
      if (cited.some((c) => c.quantified))
        assumptions.push(
          'Assumption: the reported figures use a stable baseline. None of the sources states the baseline method.',
        );
      if (cited.some((c) => c.claim_type === 'FORECAST'))
        assumptions.push(
          'Assumption: stated intent becomes delivery. Announcements and outcomes are different claims.',
        );
      assumptions.push(
        'Alternative explanation: the observed change is driven by market conditions rather than by the initiative described.',
      );
      return {
        ...base,
        directAnswer:
          contradictionRows.length > 0
            ? `There is evidence that cuts against this. ${asOfLine}`
            : `No contradicting evidence exists in the monitored sources — which is not the same as confirmation. ${asOfLine}`,
        facts: facts.slice(0, 3),
        interpretations: assumptions,
        unknowns: [
          ...unknowns,
          'Absence of contradiction in a limited source set is weak evidence of correctness.',
        ],
        followUps: ['What would change my mind?', 'What is the weakest assumption here?'],
      };
    }

    default:
      return {
        ...base,
        directAnswer: `${facts.length} evidenced statement${facts.length === 1 ? '' : 's'} bear on this. ${asOfLine}`,
        interpretations: cited
          .filter((c) => c.claim_type === 'INTERPRETATION')
          .slice(0, 3)
          .map((c) => c.text),
        hypotheses: cited
          .filter((c) => c.claim_type === 'FORECAST')
          .slice(0, 3)
          .map((c) => `Stated as a forward-looking claim by the source: ${c.text}`),
        followUps: [
          'Which of these is independently confirmed?',
          'Show me the strongest evidence only.',
        ],
      };
  }
}

// ── Filtered insight feed (the §15 filters the brief asks for) ───────────────

/**
 * Widening search: try the requested window, then progressively longer ones, and report
 * which window actually produced the results.
 *
 * An empty list for "today" is technically correct and practically useless — the honest
 * and useful answer is "nothing today; here is the last month, and that is the newest
 * there is". The window used is returned so the UI can say so rather than implying the
 * results are fresh.
 */
const WIDEN_LADDER = [1, 7, 30, 90, 365, null];

/**
 * Name matching that does not embarrass itself on short queries.
 *
 * A plain `%term%` makes "PMI" match "DeepMind" — the substring is really there, and the
 * result is that searching a client's short name returns Google. Short terms are
 * therefore anchored to the START of a word: "PMI" stops matching "DeepMind", while
 * "amaz" still finds Amazon and "Mi" still finds Microsoft, which is what someone typing
 * four letters actually wants. Longer terms keep substring matching, so "morris" finds
 * "Philip Morris" mid-name.
 *
 * The pattern is built and escaped here in JS and passed as a bound parameter, rather
 * than assembled inside SQL — escaping a regex through two layers of string quoting is
 * how the brackets-not-balanced class of bug happens.
 */
const BOUNDARY_MAX = 4;

function matchPattern(term) {
  if (term.length > BOUNDARY_MAX) return { operator: 'ilike', pattern: `%${term}%` };
  const escaped = term.replace(/[.^$*+?()[\]{}|\\-]/g, (c) => `\\${c}`);
  return { operator: '~*', pattern: `\\y${escaped}` };
}

async function filterInsightsWidening(f) {
  const requested = f.days ? Number(f.days) : null;

  // Widening only applies when a window was actually asked for. Without `days` the user
  // asked for everything, and quietly narrowing that to "the last day, then widen" would
  // change the default view from 184 items to 80 — a filter nobody selected.
  const shouldWiden = f.widen === 'true' && requested !== null;
  const ladder = shouldWiden
    ? WIDEN_LADDER.filter((d) => d === null || d > requested).slice(0)
    : [requested];
  if (shouldWiden) ladder.unshift(requested);

  for (const days of ladder) {
    const attempt = { ...f };
    if (days === null) delete attempt.days;
    else attempt.days = String(days);
    delete attempt.widen;
    const result = await filterInsights(attempt);
    if (result.total > 0 || days === ladder[ladder.length - 1]) {
      return {
        ...result,
        window: days,
        requestedWindow: requested,
        widened: days !== requested,
      };
    }
  }
  return { rows: [], total: 0, window: requested, requestedWindow: requested, widened: false };
}

async function filterInsights(f) {
  const where = ['e.is_suppressed = false'];
  const params = [];
  const add = (clause, value) => {
    params.push(value);
    where.push(clause.replace('$?', `$${params.length}`));
  };

  const list = (v) =>
    String(v)
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

  if (f.industry)
    add(
      `exists (select 1 from event_taxonomy t where t.event_id = e.id and t.kind='industry' and t.slug = $?)`,
      f.industry,
    );
  if (f.industryIn)
    add(
      `exists (select 1 from event_taxonomy t where t.event_id = e.id and t.kind='industry' and t.slug = any($?::text[]))`,
      list(f.industryIn),
    );
  if (f.topicIn)
    add(
      `exists (select 1 from event_taxonomy t where t.event_id = e.id and t.kind='topic' and t.slug = any($?::text[]))`,
      list(f.topicIn),
    );
  if (f.entityIn)
    add(
      `exists (select 1 from event_entities ee join entities en on en.id = ee.entity_id where ee.event_id = e.id and en.slug = any($?::text[]))`,
      list(f.entityIn),
    );
  if (f.maturityIn) add(`e.case_maturity = any($?::case_maturity[])`, list(f.maturityIn));
  if (f.evidenceIn) add(`e.evidence_strength = any($?::evidence_strength[])`, list(f.evidenceIn));
  if (f.eventTypeIn) add(`e.event_type = any($?::event_type[])`, list(f.eventTypeIn));
  if (f.impactIn) add(`e.strategic_impact = any($?::strategic_impact[])`, list(f.impactIn));
  if (f.topic)
    add(
      `exists (select 1 from event_taxonomy t where t.event_id = e.id and t.kind='topic' and t.slug = $?)`,
      f.topic,
    );
  if (f.technology)
    add(
      `exists (select 1 from event_taxonomy t where t.event_id = e.id and t.kind='technology' and t.slug = $?)`,
      f.technology,
    );
  if (f.entity)
    add(
      `exists (select 1 from event_entities ee join entities en on en.id = ee.entity_id where ee.event_id = e.id and en.slug = $?)`,
      f.entity,
    );
  if (f.eventType) add(`e.event_type = $?`, f.eventType);
  if (f.maturity) add(`e.case_maturity = $?`, f.maturity);
  if (f.evidence) add(`e.evidence_strength = $?`, f.evidence);
  if (f.impact) add(`e.strategic_impact = $?`, f.impact);
  if (f.novelty) add(`i.novelty = $?`, f.novelty);
  if (f.days)
    add(
      `coalesce(e.event_at, e.first_reported_at) >= now() - ($? || ' days')::interval`,
      String(f.days),
    );
  if (f.maxMinutes) add(`i.estimated_reading_minutes <= $?`, Number(f.maxMinutes));
  if (f.independentOnly === 'true') where.push('e.independent_source_count > 0');
  if (f.excludeDemo === 'true') where.push('i.is_demo = false');

  if (f.perspective) {
    const groups = {
      OFFICIAL_COMPANY: ['FIRST_PARTY_COMPANY', 'FIRST_PARTY_CLIENT'],
      TECHNOLOGY_PROVIDERS: ['FIRST_PARTY_TECH_PROVIDER'],
      CONSULTING: ['FIRST_PARTY_CONSULTING_FIRM'],
      INDEPENDENT_MEDIA: ['INDEPENDENT_BUSINESS_MEDIA', 'INDUSTRY_MEDIA'],
      REGULATORS: ['REGULATOR', 'PUBLIC_INSTITUTION'],
      RESEARCH: ['RESEARCH_INSTITUTION', 'ACADEMIC_SOURCE'],
    };
    const list = groups[f.perspective];
    if (list) {
      params.push(list);
      where.push(`exists (
        select 1 from event_documents ed join raw_documents rd on rd.id = ed.document_id
        join sources s on s.id = rd.source_id
        where ed.event_id = e.id and s.perspective = any($${params.length}::source_perspective[]))`);
    }
  }

  const rows = await q(
    `select i.id, i.headline, i.takeaway, i.novelty, i.is_demo, i.estimated_reading_minutes minutes,
            e.event_at, e.first_reported_at, e.case_maturity, e.evidence_strength,
            e.verification_status, e.first_party_only, e.source_count,
            e.independent_source_count, e.strategic_impact, e.event_type,
            (select string_agg(t.slug, ',') from event_taxonomy t where t.event_id = e.id and t.kind='industry') industries,
            (select string_agg(en.name, ', ') from event_entities ee join entities en on en.id = ee.entity_id where ee.event_id = e.id limit 1) entities
     from insights i join events e on e.id = i.event_id
     where ${where.join(' and ')}
     order by coalesce(e.event_at, e.first_reported_at) desc
     limit 40`,
    params,
  );

  const [{ n }] = await q(
    `select count(*)::int n from insights i join events e on e.id = i.event_id where ${where.join(' and ')}`,
    params,
  );

  return { rows, total: n };
}

async function facets() {
  const [industries, topics, technologies, entities, eventTypes, maturities, evidences] = [
    await q(
      `select distinct t.slug, i.name from event_taxonomy t join industries i on i.slug=t.slug where t.kind='industry' order by i.name`,
    ),
    await q(
      `select distinct t.slug, tp.name from event_taxonomy t join topics tp on tp.slug=t.slug where t.kind='topic' order by tp.name`,
    ),
    await q(
      `select distinct t.slug, te.name from event_taxonomy t join technologies te on te.slug=t.slug where t.kind='technology' order by te.name`,
    ),
    await q(
      `select en.slug, en.name, count(*)::int n from event_entities ee join entities en on en.id=ee.entity_id group by 1,2 order by n desc limit 24`,
    ),
    await q(
      `select event_type slug, event_type name, count(*)::int n from events group by 1 order by n desc`,
    ),
    await q(
      `select case_maturity slug, case_maturity name, count(*)::int n from events group by 1 order by n desc`,
    ),
    await q(
      `select evidence_strength slug, evidence_strength name, count(*)::int n from events group by 1 order by n desc`,
    ),
  ];
  return { industries, topics, technologies, entities, eventTypes, maturities, evidences };
}

// ── Server ───────────────────────────────────────────────────────────────────

const shell = () => readFileSync(new URL('./app.html', import.meta.url), 'utf8');
/** The operator console — the current design. `/` serves it; `/legacy` keeps the old shell. */
const consoleShell = () => readFileSync(new URL('./console.html', import.meta.url), 'utf8');

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const json = (data, code = 200) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  try {
    if (url.pathname === '/' || url.pathname === '/console.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(consoleShell());
    }

    if (url.pathname === '/legacy') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(shell());
    }

    if (url.pathname === '/api/facets') return json(await facets());

    if (url.pathname === '/api/profile') {
      const profile =
        (
          await q(`select role, industry_slugs, topic_slugs, technology_slugs,
                        daily_reading_minutes, preferred_depth
                 from user_profiles limit 1`)
        )[0] ?? {};
      const watchlist = await q(
        `select en.slug, en.name from watchlist_items wi
         join entities en on en.id = wi.entity_id limit 12`,
      );
      const names = async (table, slugs) =>
        slugs?.length
          ? await q(`select slug, name from ${table} where slug = any($1::text[])`, [slugs])
          : [];
      return json({
        profile,
        watchlist,
        industries: await names('industries', profile.industry_slugs),
        topics: await names('topics', profile.topic_slugs),
        technologies: await names('technologies', profile.technology_slugs),
      });
    }

    /**
     * Foresight, derived rather than invented.
     *
     * No probabilities, no predicted prices, no assertions about outcomes. Every band
     * below is a query over stored evidence, and every item states the falsifier — the
     * observation that would settle it. A confidence number we could not justify would
     * be the single most damaging thing this product could ship.
     */
    /** Event volume by day, for the sparkline in the status bar. */
    if (url.pathname === '/api/timeseries') {
      return json(
        // `day` is a reserved word in this position; alias as `bucket`.
        await q(`select to_char(d.bucket,'YYYY-MM-DD') as label, count(e.id)::int as n
                 from generate_series(now() - interval '29 days', now(), interval '1 day') as d(bucket)
                 left join events e
                   on date_trunc('day', coalesce(e.event_at, e.first_reported_at)) = date_trunc('day', d.bucket)
                   and e.is_suppressed = false
                 group by d.bucket order by d.bucket`),
      );
    }

    /** Distribution bars: where the corpus actually sits. */
    if (url.pathname === '/api/mix') {
      return json({
        maturity: await q(`select case_maturity slug, count(*)::int n from events
                           where is_suppressed=false group by 1 order by n desc`),
        perspective: await q(`select s.perspective slug, count(rd.id)::int n from sources s
                              join raw_documents rd on rd.source_id = s.id
                              group by 1 order by n desc`),
        evidence: await q(`select evidence_strength slug, count(*)::int n from events
                           where is_suppressed=false group by 1 order by n desc`),
      });
    }

    /** Everything the command palette can jump to. */
    if (url.pathname === '/api/palette') {
      return json({
        companies: await q(`select en.slug, en.name, count(ee.event_id)::int n
                            from entities en left join event_entities ee on ee.entity_id=en.id
                            group by 1,2 order by n desc limit 40`),
        industries: await q(`select slug, name from industries order by name`),
        topics: await q(`select slug, name from topics order by name`),
        units: await q(`select slug, title from learning_units order by position`),
      });
    }

    /** System health for the status bar. */
    if (url.pathname === '/api/health') {
      return json(
        (
          await q(`select
            (select count(*)::int from source_connectors where is_active and health='healthy') healthy,
            (select count(*)::int from source_connectors where health='failing') failing,
            (select count(*)::int from source_connectors where is_active) active,
            (select max(last_success_at) from source_connectors) last_sync,
            (select count(*)::int from claims c where c.claim_type='FACT'
               and not exists (select 1 from claim_evidence ce where ce.claim_id=c.id)) unevidenced,
            (select status from pipeline_runs order by started_at desc limit 1) last_run,
            (select started_at from pipeline_runs order by started_at desc limit 1) last_run_at`)
        )[0],
      );
    }

    /** Schema introspection — used while building; read-only. */
    if (url.pathname === '/api/schema') {
      const like = url.searchParams.get('like') || '%';
      const cols = url.searchParams.get('cols');
      if (cols) {
        return json(
          await q(
            `select column_name, data_type from information_schema.columns
             where table_schema='public' and table_name = $1 order by ordinal_position`,
            [cols],
          ),
        );
      }
      return json(
        await q(
          `select table_name, count(*)::int cols from information_schema.columns
           where table_schema='public' and table_name like $1 group by 1 order by 1`,
          [like],
        ),
      );
    }

    /** Typeahead over EVERY entity, including ones with no coverage yet.
     *  Hiding a zero-coverage company would answer a question the user did not ask:
     *  "we have nothing on them" is information, and it is different from "not offered". */
    if (url.pathname === '/api/entities') {
      const term = (url.searchParams.get('q') || '').trim();
      const { operator, pattern } = matchPattern(term);
      const m = (col) => `${col} ${operator} $2`;
      const rows = await q(
        `select en.slug, en.name, en.kind, en.description,
                count(distinct e.id)::int n,
                max(coalesce(e.event_at, e.first_reported_at)) last_seen,
                (select string_agg(distinct i.name, ', ') from entity_industries ei
                   join industries i on i.id = ei.industry_id where ei.entity_id = en.id) industries,
                (select i.slug from industries i where i.id = en.primary_industry_id) primary_industry,
                (select string_agg(al.alias, ', ') from entity_aliases al
                   where al.entity_id = en.id) aliases,
                (select al.alias from entity_aliases al where al.entity_id = en.id
                   and $1 <> '' and (${m('al.alias')} or ${m('al.normalized')})
                   limit 1) matched_alias
         from entities en
         left join event_entities ee on ee.entity_id = en.id
         left join events e on e.id = ee.event_id and e.is_suppressed = false
         where ($1 = '' or ${m('en.name')} or ${m('en.slug')} or ${m('en.legal_name')}
                -- Aliases matter most for exactly the case that fails without them:
                -- a short form like "PMI" that shares no substring with the full name.
                or exists (select 1 from entity_aliases al where al.entity_id = en.id
                           and (${m('al.alias')} or ${m('al.normalized')})))
         group by en.id, en.slug, en.name, en.kind, en.description
         order by n desc, en.name asc
         limit 60`,
        [term, pattern],
      );
      return json(rows);
    }

    /** Client focus — the brief's Mission Mode, read back. */
    if (url.pathname === '/api/missions') {
      return json(
        await q(
          `select m.id, m.name, m.description, m.industry_slugs, m.topic_slugs,
                  m.technology_slugs, m.entity_ids, m.starts_at, m.ends_at, m.is_paused,
                  -- entity_ids is jsonb, so unnest it rather than treating it as uuid[]
                  (select string_agg(en.name, ', ') from entities en
                     where en.id::text in (select jsonb_array_elements_text(m.entity_ids))) entity_names,
                  (select string_agg(en.slug, ',') from entities en
                     where en.id::text in (select jsonb_array_elements_text(m.entity_ids))) entity_slugs
           from user_missions m where m.is_paused = false order by m.created_at desc`,
        ),
      );
    }

    /** One account, widened by scope until it has something to say.
     *
     *  The first version keyed everything off the entity's primary industry, so an
     *  unclassified company returned three empty rings — a blank screen for exactly the
     *  user who most needs context. This walks a ladder instead, mirroring the time
     *  ladder in filterInsightsWidening:
     *
     *    the company → who it is compared against → its industry → its topics → the market
     *
     *  and reports which level produced the answer. The last rung has no filter, so the
     *  response is never empty. "Nothing on your client, but here is what moved in the
     *  market" is the whole point of a market-intelligence product; a blank page is not
     *  an answer a consultant can take into a meeting.
     */
    if (url.pathname === '/api/account' && url.searchParams.get('slug')) {
      const slug = url.searchParams.get('slug');
      const industryOverride = url.searchParams.get('industry');

      const [entity] = await q(
        `select en.slug, en.name, en.legal_name, en.description, en.kind, en.ticker,
                en.official_domain, en.is_demo,
                (select i.slug from industries i where i.id = en.primary_industry_id) industry_slug,
                (select i.name from industries i where i.id = en.primary_industry_id) industry_name,
                (select string_agg(al.alias, ', ') from entity_aliases al
                   where al.entity_id = en.id) aliases
         from entities en where en.slug = $1`,
        [slug],
      );
      if (!entity) return json({ error: 'unknown entity' }, 404);

      // Industry resolution, in order of how specific the signal is: an explicit
      // override, the primary industry, the entity_industries join, then whatever the
      // user's own profile says. A null primary industry must not end the search.
      const linked = await q(
        `select i.slug, i.name from entity_industries ei
         join industries i on i.id = ei.industry_id
         join entities en on en.id = ei.entity_id
         where en.slug = $1`,
        [slug],
      );
      const [profile] = await q(`select industry_slugs, topic_slugs from user_profiles limit 1`);
      const profileIndustries = profile?.industry_slugs ?? [];
      const profileTopics = profile?.topic_slugs ?? [];

      const industries = [
        ...(industryOverride ? [industryOverride] : []),
        ...(entity.industry_slug ? [entity.industry_slug] : []),
        ...linked.map((r) => r.slug),
      ].filter((v, i, a) => a.indexOf(v) === i);
      const industrySlugs = industries.length ? industries : profileIndustries;
      const industryIsInferred = !industries.length && profileIndustries.length > 0;

      const [{ names: industryNames } = { names: null }] = industrySlugs.length
        ? await q(
            `select string_agg(name, ', ') names from industries where slug = any($1::text[])`,
            [industrySlugs],
          )
        : [{ names: null }];

      const EVENT_COLUMNS = `e.id, e.title, e.case_maturity, e.evidence_strength, e.event_at,
        e.first_reported_at, e.source_count, e.independent_source_count, e.first_party_only,
        e.strategic_impact, i.id insight_id, i.takeaway,
        (select string_agg(en2.name, ', ') from event_entities ee2
           join entities en2 on en2.id = ee2.entity_id where ee2.event_id = e.id) entities`;

      const direct = await q(
        `select ${EVENT_COLUMNS}
         from events e
         join event_entities ee on ee.event_id = e.id
         join entities en on en.id = ee.entity_id
         left join insights i on i.event_id = e.id
         where en.slug = $1 and e.is_suppressed = false
         order by coalesce(e.event_at, e.first_reported_at) desc limit 25`,
        [slug],
      );

      const peers = industrySlugs.length
        ? await q(
            `select en.slug, en.name, count(distinct e.id)::int n
             from entities en
             join entity_industries ei on ei.entity_id = en.id
             join industries ind on ind.id = ei.industry_id and ind.slug = any($1::text[])
             left join event_entities ee on ee.entity_id = en.id
             left join events e on e.id = ee.event_id and e.is_suppressed = false
             where en.slug <> $2
             group by en.slug, en.name order by n desc, en.name limit 12`,
            [industrySlugs, slug],
          )
        : [];

      const peerSlugs = peers.filter((p) => p.n > 0).map((p) => p.slug);
      const peerEvents = peerSlugs.length
        ? await q(
            `select ${EVENT_COLUMNS}
             from events e
             join event_entities ee on ee.event_id = e.id
             join entities en on en.id = ee.entity_id
             left join insights i on i.event_id = e.id
             where en.slug = any($1::text[]) and e.is_suppressed = false
             order by coalesce(e.event_at, e.first_reported_at) desc limit 15`,
            [peerSlugs],
          )
        : [];

      const industryEvents = industrySlugs.length
        ? await q(
            `select ${EVENT_COLUMNS}
             from events e
             join event_taxonomy t on t.event_id = e.id and t.kind = 'industry'
                  and t.slug = any($1::text[])
             left join insights i on i.event_id = e.id
             where e.is_suppressed = false
               and not exists (select 1 from event_entities ee3
                               join entities en3 on en3.id = ee3.entity_id
                               where ee3.event_id = e.id and en3.slug = $2)
             order by coalesce(e.event_at, e.first_reported_at) desc limit 20`,
            [industrySlugs, slug],
          )
        : [];

      // Topics cut across industries, so they keep working when the industry itself has
      // no coverage — regulation, pricing, supply chain and workforce apply to a tobacco
      // client as readily as to a retailer.
      const topicSlugs = profileTopics.length
        ? profileTopics
        : (await q(`select slug from topics order by slug limit 6`)).map((r) => r.slug);
      const topicEvents = await q(
        `select ${EVENT_COLUMNS},
                (select string_agg(distinct t2.slug, ', ') from event_taxonomy t2
                   where t2.event_id = e.id and t2.kind = 'topic') topics
         from events e
         join event_taxonomy t on t.event_id = e.id and t.kind = 'topic'
              and t.slug = any($1::text[])
         left join insights i on i.event_id = e.id
         where e.is_suppressed = false
           and not exists (select 1 from event_entities ee3
                           join entities en3 on en3.id = ee3.entity_id
                           where ee3.event_id = e.id and en3.slug = $2)
         order by coalesce(e.event_at, e.first_reported_at) desc limit 20`,
        [topicSlugs, slug],
      );

      // The last rung: no filter at all, ranked by impact then recency. This is what
      // guarantees the page is never empty.
      const market = await q(
        `select ${EVENT_COLUMNS}
         from events e left join insights i on i.event_id = e.id
         where e.is_suppressed = false
         order by case e.strategic_impact
                    when 'very_high' then 0 when 'high' then 1
                    when 'moderate' then 2 else 3 end,
                  coalesce(e.event_at, e.first_reported_at) desc
         limit 15`,
      );

      const related = await q(
        `select er.kind relationship, er.note, en2.slug, en2.name
         from entity_relationships er
         join entities en1 on en1.id = er.from_entity_id
         join entities en2 on en2.id = er.to_entity_id
         where en1.slug = $1 limit 12`,
        [slug],
      );

      const sources = await q(
        `select s.name, s.perspective, sc.is_active, sc.health
         from sources s
         left join source_connectors sc on sc.source_id = s.id
         where s.subject_entity_id = (select id from entities where slug = $1)`,
        [slug],
      );

      const ladder = [
        { level: 'company', label: entity.name, events: direct },
        { level: 'peers', label: 'Companies it is compared against', events: peerEvents },
        { level: 'industry', label: industryNames || 'Industry', events: industryEvents },
        { level: 'topics', label: 'Cross-industry topics', events: topicEvents },
        { level: 'market', label: 'The wider market', events: market },
      ];
      const leadWith = ladder.find((r) => r.events.length > 0)?.level ?? 'market';

      return json({
        entity,
        industries: industrySlugs,
        industryNames,
        industryIsInferred,
        allIndustries: await q(`select slug, name from industries order by name`),
        direct,
        peers,
        peerEvents,
        industryEvents,
        topicEvents,
        topicSlugs,
        market,
        related,
        sources,
        leadWith,
        counts: Object.fromEntries(ladder.map((r) => [r.level, r.events.length])),
      });
    }

    /** Extractive key passages.
     *
     *  Deliberately NOT a generated summary. The sentences are returned verbatim with
     *  their character offsets, ranked by how much information they carry — figures,
     *  dates, named entities, outcome language. Nothing is rewritten, so nothing can be
     *  introduced that the document did not say. */
    if (url.pathname === '/api/passages' && url.searchParams.get('id')) {
      const id = url.searchParams.get('id');
      const [doc] = await q(
        `select dv.id version_id, dv.normalized_text, dv.excerpt, rd.title, rd.url,
                rd.published_at, s.name source_name, s.perspective, dv.stored_scope
         from insights i
         join events e on e.id = i.event_id
         join event_claims ec on ec.event_id = e.id
         join claims c on c.id = ec.claim_id
         join document_versions dv on dv.id = c.document_version_id
         join raw_documents rd on rd.id = dv.document_id
         join sources s on s.id = c.source_id
         where i.id = $1
         order by length(dv.normalized_text) desc nulls last
         limit 1`,
        [id],
      );
      if (!doc || !doc.normalized_text) return json({ passages: [], reason: 'no_stored_text' });

      const claimRows = await q(
        `select c.text, c.claim_type, c.quantified, es.start_offset, es.end_offset
         from insights i
         join events e on e.id = i.event_id
         join event_claims ec on ec.event_id = e.id
         join claims c on c.id = ec.claim_id
         join claim_evidence ce on ce.claim_id = c.id
         join evidence_spans es on es.id = ce.evidence_span_id
         where i.id = $1 and es.document_version_id = $2
         order by es.start_offset`,
        [id, doc.version_id],
      );
      return json({ document: doc, claims: claimRows });
    }

    /** Free-text search over the corpus, for terms that match no tracked entity.
     *
     *  Answers a different question from the entity filter: "does anything we monitor
     *  mention this word at all?" A term with no entity and no mention is a coverage
     *  gap, and saying so is more useful than an empty list. */
    if (url.pathname === '/api/lookup' && url.searchParams.get('q')) {
      const term = url.searchParams.get('q').trim();
      const { operator, pattern } = matchPattern(term);
      const m = (col) => `${col} ${operator} $1`;
      const entities = await q(
        `select en.slug, en.name, en.legal_name,
                (select string_agg(al.alias, ', ') from entity_aliases al where al.entity_id = en.id) aliases,
                count(distinct e.id)::int n
         from entities en
         left join event_entities ee on ee.entity_id = en.id
         left join events e on e.id = ee.event_id and e.is_suppressed = false
         where ${m('en.name')} or ${m('en.legal_name')}
            or exists (select 1 from entity_aliases al where al.entity_id = en.id
                       and (${m('al.alias')} or ${m('al.normalized')}))
         group by en.id, en.slug, en.name, en.legal_name limit 10`,
        [pattern],
      );
      // OR the words: a multi-word term should not need every word present.
      const tsq = term.split(/\s+/).filter(Boolean).join(' | ');
      const mentions = await q(
        `select e.id, e.title, e.case_maturity, e.evidence_strength, e.event_at,
                e.first_reported_at, e.source_count, i.id insight_id
         from events e left join insights i on i.event_id = e.id
         where e.is_suppressed = false and e.search_vector @@ to_tsquery('english', $1)
         order by coalesce(e.event_at, e.first_reported_at) desc limit 15`,
        [tsq],
      );
      const claimHits = await q(
        `select count(*)::int n from claims c where c.search_vector @@ to_tsquery('english', $1)`,
        [tsq],
      );
      return json({ term, entities, mentions, claimMentions: claimHits[0]?.n ?? 0 });
    }

    if (url.pathname === '/api/watch') {
      const stated = await q(
        `select c.id, c.text, s.name source_name, s.perspective, rd.published_at,
                rd.title doc_title, rd.url doc_url
         from claims c
         join document_versions dv on dv.id = c.document_version_id
         join raw_documents rd on rd.id = dv.document_id
         join sources s on s.id = c.source_id
         join claim_evidence ce on ce.claim_id = c.id
         where c.claim_type = 'FORECAST'
         order by rd.published_at desc nulls last limit 12`,
      );

      const awaitingScale = await q(
        `select e.id, e.title, e.case_maturity, e.event_at, e.first_reported_at,
                e.first_party_only, e.source_count, i.id insight_id,
                (select string_agg(en.name, ', ') from event_entities ee
                   join entities en on en.id = ee.entity_id where ee.event_id = e.id) entities,
                extract(day from now() - coalesce(e.event_at, e.first_reported_at))::int age_days
         from events e left join insights i on i.event_id = e.id
         where e.case_maturity in ('PILOT','LIMITED_DEPLOYMENT','CONCEPT')
           and e.is_suppressed = false
         order by coalesce(e.event_at, e.first_reported_at) desc limit 10`,
      );

      const unconfirmed = await q(
        `select e.id, e.title, e.case_maturity, e.first_reported_at, e.source_count,
                i.id insight_id,
                (select string_agg(en.name, ', ') from event_entities ee
                   join entities en on en.id = ee.entity_id where ee.event_id = e.id) entities
         from events e left join insights i on i.event_id = e.id
         where e.first_party_only = true
           and e.case_maturity in ('QUANTIFIED_BUSINESS_IMPACT','SCALED_DEPLOYMENT')
           and e.is_suppressed = false
         order by coalesce(e.event_at, e.first_reported_at) desc limit 10`,
      );

      const disputed = await q(
        `select e.id, e.title, i.id insight_id,
                (select string_agg(x.explanation, ' | ') from contradictions x where x.event_id = e.id) why
         from events e left join insights i on i.event_id = e.id
         where e.verification_status = 'DISPUTED' limit 8`,
      );

      const hypotheses = await q(
        `select distinct on (ca.text) ca.text, i.id insight_id, i.headline
         from conversation_applications ca
         join insights i on i.id = ca.insight_id
         where ca.kind = 'hypothesis' limit 10`,
      );

      const reversals = await q(
        `select e.id, e.title, e.first_reported_at, i.id insight_id
         from events e left join insights i on i.event_id = e.id
         where e.case_maturity = 'DISCONTINUED_OR_REVERSED' limit 6`,
      );

      // Entities we watch but have heard nothing from — a gap, stated as one.
      const quiet = await q(
        `select en.name, en.slug,
                max(coalesce(e.event_at, e.first_reported_at)) last_seen,
                count(e.id)::int events
         from watchlist_items wi
         join entities en on en.id = wi.entity_id
         left join event_entities ee on ee.entity_id = en.id
         left join events e on e.id = ee.event_id
         group by 1,2 order by last_seen nulls first limit 8`,
      );

      const counts = (
        await q(`select
          (select count(*)::int from events where case_maturity in ('ANNOUNCED','CONCEPT')) announced,
          (select count(*)::int from events where case_maturity='PILOT') pilots,
          (select count(*)::int from events where case_maturity in ('QUANTIFIED_BUSINESS_IMPACT','INDEPENDENTLY_VALIDATED_IMPACT')) measured,
          (select count(*)::int from events where verification_status='DISPUTED') disputed,
          (select count(*)::int from claims where claim_type='FORECAST') forecasts`)
      )[0];

      return json({
        stated,
        awaitingScale,
        unconfirmed,
        disputed,
        hypotheses,
        reversals,
        quiet,
        counts,
      });
    }

    if (url.pathname === '/api/learn') {
      const paths = await q(
        `select id, slug, name, description from learning_paths order by position`,
      );
      const units = await q(
        `select u.id, u.slug, u.title, u.objective, u.depth, u.estimated_minutes,
                u.path_id, u.last_reviewed_at, (u.knowledge_check is not null) has_check,
                u.explanation, u.structured_model, u.key_terms, u.common_misconceptions,
                u.practical_questions
         from learning_units u order by u.position`,
      );
      const states = await q(
        `select c.name, k.state, k.reason, k.user_asserted, k.confidence
         from user_knowledge_states k join learning_concepts c on c.id = k.concept_id limit 30`,
      );
      return json({ paths, units, states });
    }

    if (url.pathname === '/api/library') {
      return json({
        notes: await q(
          `select title, body, created_at from notes order by created_at desc limit 20`,
        ),
        saved: await q(
          `select i.id, i.headline, i.takeaway from saved_insights s
           join insights i on i.id = s.insight_id order by s.created_at desc limit 20`,
        ),
        conversations: await q(
          `select id, title, mode, had_voice, updated_at from conversations
           order by updated_at desc limit 20`,
        ),
        meetings: await q(
          `select id, title, company_name, created_at from meetings order by created_at desc limit 20`,
        ),
      });
    }

    if (url.pathname === '/api/prepare') {
      return json({
        companies: await q(
          `select en.slug, en.name, count(ee.event_id)::int events
           from entities en left join event_entities ee on ee.entity_id = en.id
           where en.kind = 'company' group by 1,2 order by events desc limit 30`,
        ),
      });
    }

    if (url.pathname === '/api/company' && url.searchParams.get('slug')) {
      const slug = url.searchParams.get('slug');
      const entity = (await q(`select * from entities where slug = $1`, [slug]))[0];
      if (!entity) return json({ error: 'not found' }, 404);
      const timeline = await q(
        `select e.id, e.title, e.summary, e.event_type, e.event_at, e.first_reported_at,
                e.case_maturity, e.evidence_strength, e.verification_status,
                e.first_party_only, e.source_count, e.is_demo, i.id insight_id
         from event_entities ee join events e on e.id = ee.event_id
         left join insights i on i.event_id = e.id
         where ee.entity_id = $1 and e.is_suppressed = false
         order by coalesce(e.event_at, e.first_reported_at) desc limit 30`,
        [entity.id],
      );
      const mix = await q(
        `select e.case_maturity slug, count(*)::int n from event_entities ee
         join events e on e.id = ee.event_id where ee.entity_id = $1
         group by 1 order by n desc`,
        [entity.id],
      );
      const monitoring = await q(
        `select name, perspective from sources where subject_entity_id = $1`,
        [entity.id],
      );
      return json({ entity, timeline, mix, monitoring });
    }

    if (url.pathname === '/api/industry' && url.searchParams.get('slug')) {
      const slug = url.searchParams.get('slug');
      const industry = (await q(`select * from industries where slug = $1`, [slug]))[0];
      if (!industry) return json({ error: 'not found' }, 404);
      return json({
        industry,
        stages: await q(
          `select name, description, profit_pool_note from value_chain_stages
           where industry_id = $1 order by position`,
          [industry.id],
        ),
        kpis: await q(
          `select name, definition, formula, why_it_matters, typical_range, parent_id, id
           from kpis where industry_id = $1 order by parent_id nulls first, name`,
          [industry.id],
        ),
        models: await q(
          `select name, description, economics, example_company_names from business_models
           where industry_id = $1`,
          [industry.id],
        ),
      });
    }

    if (url.pathname === '/api/insights') {
      return json(await filterInsightsWidening(Object.fromEntries(url.searchParams)));
    }

    if (url.pathname === '/api/stats') {
      return json(
        (
          await q(`select
            (select count(*)::int from raw_documents) documents,
            (select count(*)::int from claims) claims,
            (select count(*)::int from events) events,
            (select count(*)::int from insights) insights,
            (select count(*)::int from source_connectors where is_active) active_sources,
            (select count(*)::int from contradictions) contradictions,
            (select count(*)::int from claims c where c.claim_type='FACT'
               and not exists (select 1 from claim_evidence ce where ce.claim_id=c.id)) unevidenced,
            (select count(*)::int from learning_connections) connections`)
        )[0],
      );
    }

    if (url.pathname === '/api/maturity-mix') {
      return json(
        await q(
          `select case_maturity slug, count(*)::int n from events group by 1 order by n desc`,
        ),
      );
    }

    if (url.pathname === '/api/insight' && url.searchParams.get('id')) {
      const id = url.searchParams.get('id');
      const insight = (
        await q(
          `select i.*, e.case_maturity, e.evidence_strength, e.verification_status,
                  e.first_party_only, e.source_count, e.independent_source_count,
                  e.event_type, e.event_at, e.first_reported_at, e.strategic_impact, e.id event_id
           from insights i join events e on e.id=i.event_id where i.id = $1`,
          [id],
        )
      )[0];
      if (!insight) return json({ error: 'not found' }, 404);

      const claims = await q(
        `select c.id, c.text, c.claim_type, c.evidence_strength, c.quantified,
                es.quote, es.start_offset, es.end_offset, dv.normalized_text,
                rd.title doc_title, rd.url doc_url, rd.published_at,
                s.name source_name, s.perspective
         from event_claims ec join claims c on c.id=ec.claim_id
         join document_versions dv on dv.id=c.document_version_id
         join raw_documents rd on rd.id=dv.document_id
         join sources s on s.id=c.source_id
         left join claim_evidence ce on ce.claim_id=c.id
         left join evidence_spans es on es.id=ce.evidence_span_id
         where ec.event_id=$1 order by c.claim_type, c.confidence desc`,
        [insight.event_id],
      );
      const apps = await q(`select kind, text from conversation_applications where insight_id=$1`, [
        id,
      ]);
      const conns = await q(
        `select lc.explanation, c.name from learning_connections lc
         join learning_concepts c on c.id=lc.concept_id where lc.insight_id=$1 limit 6`,
        [id],
      );
      const conflicts = await q(`select explanation from contradictions where event_id=$1`, [
        insight.event_id,
      ]);
      return json({ insight, claims, apps, conns, conflicts });
    }

    if (url.pathname === '/api/ask' && req.method === 'POST') {
      const body = await new Promise((resolve) => {
        let data = '';
        req.on('data', (c) => (data += c));
        req.on('end', () => resolve(data));
      });
      const { question, mode } = JSON.parse(body || '{}');
      if (!question || !String(question).trim()) return json({ error: 'empty question' }, 400);
      return json(
        await answer({ question: String(question).slice(0, 2000), mode: mode || 'explore_it' }),
      );
    }

    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  } catch (err) {
    console.error(err);
    json({ error: err.message }, 500);
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Interactive preview  http://127.0.0.1:${PORT}`);
  console.log(`  Reading the live database over TCP on :55432`);
  console.log(`  Preview harness only — not the product. See the header comment.\n`);
});
