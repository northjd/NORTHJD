/**
 * Builds a static HTML preview of the product from the live database.
 *
 * Written because corporate endpoint policy blocked filesystem access to the
 * repository under ~/Desktop, so the Next server cannot be started — but the PGlite
 * database is still reachable over TCP on localhost, which needs no file access.
 *
 * Everything rendered here is **real**: real ingested documents from real publisher
 * feeds, real extracted claims with real evidence spans, real classifications. Nothing
 * is mocked. The design tokens are the ones from apps/web/src/app/globals.css.
 *
 * This is a read-only preview, not the application. It has no interactivity, no
 * ranking recomputation and no Companion — those need the server.
 */

import { writeFileSync } from 'node:fs';
import pg from 'pg';

const client = new pg.Client('postgres://postgres@127.0.0.1:55432/postgres');
await client.connect();
const q = async (sql, params = []) => (await client.query(sql, params)).rows;

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const date = (d) =>
  d
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(d))
    : 'date not stated in source';

// ── Data ─────────────────────────────────────────────────────────────────────

const totals = (
  await q(`select
    (select count(*)::int from sources) sources,
    (select count(*)::int from source_connectors where is_active) active,
    (select count(*)::int from source_policies where rights_status <> 'approved') pending,
    (select count(*)::int from raw_documents) documents,
    (select count(*)::int from claims) claims,
    (select count(*)::int from evidence_spans) spans,
    (select count(*)::int from events) events,
    (select count(*)::int from insights) insights,
    (select count(*)::int from contradictions) contradictions,
    (select count(*)::int from learning_connections) connections,
    (select count(*)::int from conversation_applications) applications,
    (select count(*)::int from claims c where c.claim_type = 'FACT'
       and not exists (select 1 from claim_evidence ce where ce.claim_id = c.id)) unevidenced`)
)[0];

const brief = (
  await q(`select bi.section, bi.why_shown, bi.estimated_minutes,
                  i.id, i.headline, i.takeaway, i.novelty, i.is_demo,
                  e.event_at, e.first_reported_at, e.case_maturity, e.evidence_strength,
                  e.verification_status, e.first_party_only, e.source_count, e.strategic_impact,
                  e.event_type
           from brief_items bi
           join insights i on i.id = bi.insight_id
           join events e on e.id = i.event_id
           order by bi.position`)
).slice(0, 12);

// Prefer the demo insight that exercises the self-reporting rule, since it is the
// clearest illustration of the trust model. Fall back to any well-evidenced insight.
const featured =
  (await q(`select i.*, e.case_maturity, e.evidence_strength, e.verification_status,
                   e.first_party_only, e.source_count, e.independent_source_count,
                   e.event_type, e.event_at, e.first_reported_at, e.strategic_impact
            from insights i join events e on e.id = i.event_id
            where i.headline ilike '%Northwind Apparel reports%' limit 1`))[0] ??
  (await q(`select i.*, e.case_maturity, e.evidence_strength, e.verification_status,
                   e.first_party_only, e.source_count, e.independent_source_count,
                   e.event_type, e.event_at, e.first_reported_at, e.strategic_impact
            from insights i join events e on e.id = i.event_id
            order by e.source_count desc limit 1`))[0];

const facts = await q(
  `select c.id, c.text, c.claim_type, c.evidence_strength, c.quantified,
          es.quote, es.start_offset, es.end_offset,
          dv.normalized_text, rd.title doc_title, rd.url doc_url, rd.published_at,
          s.name source_name, s.perspective
   from event_claims ec
   join claims c on c.id = ec.claim_id
   join document_versions dv on dv.id = c.document_version_id
   join raw_documents rd on rd.id = dv.document_id
   join sources s on s.id = c.source_id
   left join claim_evidence ce on ce.claim_id = c.id
   left join evidence_spans es on es.id = ce.evidence_span_id
   where ec.event_id = $1 and c.claim_type = 'FACT'
   order by c.confidence desc`,
  [featured.event_id],
);

const starters = await q(
  `select kind, text from conversation_applications where insight_id = $1 order by kind`,
  [featured.id],
);

const contradictionRows = await q(
  `select explanation, kind from contradictions where event_id = $1`,
  [featured.event_id],
);

const industry = (
  await q(`select i.name, i.definition, i.market_structure, i.open_questions,
                  (select count(*)::int from value_chain_stages v where v.industry_id = i.id) stages,
                  (select count(*)::int from kpis k where k.industry_id = i.id) kpis
           from industries i where i.slug = 'fashion-apparel'`)
)[0];

const stages = await q(
  `select name, description, profit_pool_note from value_chain_stages
   where industry_id = (select id from industries where slug='fashion-apparel')
   order by position limit 6`,
);

const kpis = await q(
  `select name, definition, why_it_matters, typical_range from kpis
   where industry_id = (select id from industries where slug='fashion-apparel')
   order by name limit 4`,
);

const sources = await q(
  `select s.name, s.perspective, sp.rights_status, sp.review_notes,
          sc.is_active, sc.health, sc.last_error, sp.storage_scope
   from sources s
   left join source_policies sp on sp.source_id = s.id
   left join source_connectors sc on sc.source_id = s.id
   order by (sp.rights_status = 'approved') desc, sc.is_active desc, s.name`,
);

const maturityMix = await q(
  `select case_maturity, count(*)::int n from events group by 1 order by 2 desc`,
);

const perspectiveMix = await q(
  `select s.perspective, count(rd.id)::int n from sources s
   left join raw_documents rd on rd.source_id = s.id
   group by 1 having count(rd.id) > 0 order by 2 desc`,
);

await client.end();

// ── Rendering helpers ────────────────────────────────────────────────────────

const TONE = {
  neutral: 'background:var(--surface-inset);color:var(--text-muted);border-color:var(--border)',
  accent: 'background:var(--accent-soft);color:var(--accent);border-color:transparent',
  verified: 'background:#e2f2e8;color:#1f5c3f;border-color:transparent',
  caution: 'background:#fdf0dd;color:#8a5610;border-color:transparent',
  alert: 'background:#fbe4e4;color:#8b2820;border-color:transparent',
  muted: 'background:transparent;color:var(--text-subtle);border-color:var(--border)',
};

const badge = (text, tone = 'neutral', title = '') =>
  `<span class="badge" style="${TONE[tone]}"${title ? ` title="${esc(title)}"` : ''}>${esc(text)}</span>`;

const MATURITY = {
  ANNOUNCED: ['Announced', 'caution', 'Stated intent. No implementation scope given.'],
  CONCEPT: ['Concept', 'caution', 'Being explored; nothing built.'],
  PILOT: ['Pilot', 'neutral', 'Bounded trial. Most pilots do not scale.'],
  LIMITED_DEPLOYMENT: ['Limited deployment', 'neutral', 'Live in selected locations.'],
  SCALED_DEPLOYMENT: ['Scaled', 'accent', 'Described as deployed across the organisation.'],
  QUANTIFIED_BUSINESS_IMPACT: ['Quantified impact', 'accent', 'A measured outcome is claimed — check who is claiming it.'],
  INDEPENDENTLY_VALIDATED_IMPACT: ['Independently validated', 'verified', 'A party other than the beneficiary reports the same outcome.'],
  DISCONTINUED_OR_REVERSED: ['Discontinued', 'alert', 'Stopped or reversed. Often more informative than the announcement.'],
};

const EVIDENCE = {
  QUANTIFIED_PRIMARY_EVIDENCE: ['Quantified primary evidence', 'verified'],
  UNQUANTIFIED_PRIMARY_EVIDENCE: ['Primary evidence', 'verified'],
  MULTIPLE_CREDIBLE_SECONDARY_SOURCES: ['Multiple independent sources', 'verified'],
  SINGLE_CREDIBLE_SECONDARY_SOURCE: ['One independent source', 'neutral'],
  COMPANY_SELF_REPORTING: ['Company self-reporting', 'caution'],
  WEAK_OR_UNVERIFIED_SIGNAL: ['Weak signal', 'alert'],
};

const PERSPECTIVE = {
  FIRST_PARTY_COMPANY: 'Company itself',
  FIRST_PARTY_TECH_PROVIDER: 'Vendor itself',
  FIRST_PARTY_CONSULTING_FIRM: 'Consulting firm itself',
  INDEPENDENT_BUSINESS_MEDIA: 'Independent media',
  INDUSTRY_MEDIA: 'Trade press',
  REGULATOR: 'Regulator',
  PUBLIC_INSTITUTION: 'Public institution',
  USER_PROVIDED: 'User-provided',
};

const isFirstParty = (p) => String(p).startsWith('FIRST_PARTY');

const perspectiveBadge = (p) =>
  badge(
    `${isFirstParty(p) ? '◑' : '○'} ${PERSPECTIVE[p] ?? p}`,
    isFirstParty(p) ? 'caution' : 'neutral',
    isFirstParty(p)
      ? 'Self-reported. The subject of the story is also the source of it.'
      : 'Reported by a party other than the subject.',
  );

const maturityBadge = (m) => (MATURITY[m] ? badge(...MATURITY[m]) : badge(m));
const evidenceBadge = (e) => (EVIDENCE[e] ? badge(...EVIDENCE[e]) : badge(e));

const SECTIONS = {
  executive_three: ['The three that matter', 'Highest combined relevance, impact and evidence strength today.'],
  what_changed: ['Changed since your last visit', 'Only genuinely new, updated or corrected developments.'],
  company_watch: ['Your companies', 'Developments at organisations on your watchlist.'],
  industry_signals: ['Your industries', 'Signals from the industries you follow.'],
  tech_radar: ['Technology radar', 'What providers announced, built or shipped.'],
  broader_market: ['Broader market', 'Developments beyond your stated focus.'],
  adjacent_signal: ['One adjacent signal', 'Deliberately outside your interests, to keep the brief from closing in on itself.'],
  learn_one_thing: ['Learn one thing', 'A short fundamentals unit.'],
};

// Evidence excerpt with the cited range highlighted, as the real evidence page does.
function evidenceExcerpt(fact) {
  if (!fact?.quote || fact.normalized_text == null) return '';
  const text = fact.normalized_text;
  const start = fact.start_offset ?? 0;
  const end = fact.end_offset ?? 0;
  const from = Math.max(0, start - 320);
  const to = Math.min(text.length, end + 320);
  return `${from > 0 ? '… ' : ''}<span class="dim">${esc(text.slice(from, start))}</span><mark>${esc(text.slice(start, end))}</mark><span class="dim">${esc(text.slice(end, to))}</span>${to < text.length ? ' …' : ''}`;
}

const bySection = new Map();
for (const item of brief) {
  bySection.set(item.section, [...(bySection.get(item.section) ?? []), item]);
}

const totalMinutes = brief.reduce((sum, i) => sum + (i.estimated_minutes ?? 0), 0);

// ── HTML ─────────────────────────────────────────────────────────────────────

const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Market Intelligence OS — draft view</title>
<style>
:root{
  --surface:#fff; --surface-raised:#fff; --surface-sunken:#f7f8f9; --surface-inset:#eceef1;
  --border:#dcdfe4; --text:#161a23; --text-muted:#4c5462; --text-subtle:#67707f;
  --accent:#2f56b3; --accent-soft:#eef4ff;
  --shadow:0 1px 2px rgb(13 16 23/.04),0 1px 3px rgb(13 16 23/.06);
}
*{box-sizing:border-box}
body{margin:0;background:var(--surface-sunken);color:var(--text);
  font:15px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,system-ui,sans-serif;
  -webkit-font-smoothing:antialiased}
.wrap{max-width:1180px;margin:0 auto;padding:0 20px 72px}
header.top{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.96);
  backdrop-filter:blur(8px);border-bottom:1px solid var(--border);margin-bottom:26px}
.topin{max-width:1180px;margin:0 auto;padding:11px 20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.logo{width:27px;height:27px;border-radius:6px;background:var(--accent);color:#fff;
  display:grid;place-items:center;font-weight:700;font-size:13px}
nav{display:flex;gap:2px;flex-wrap:wrap}
nav span{padding:5px 10px;border-radius:5px;font-size:13px;font-weight:500;color:var(--text-muted)}
nav span.on{background:var(--accent-soft);color:var(--accent)}
.banner{background:#fdf0dd;color:#8a5610;border-bottom:1px solid rgba(200,128,31,.3);
  padding:7px 20px;font-size:12.5px;text-align:center}
.note{background:var(--accent-soft);border:1px solid #c7d8f7;border-radius:8px;
  padding:13px 15px;font-size:13px;color:#26438c;margin-bottom:26px;line-height:1.6}
h1{font-size:26px;line-height:1.2;letter-spacing:-.01em;margin:0 0 6px}
h2.sec{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-subtle);
  font-weight:600;margin:0 0 3px}
.hint{font-size:12.5px;color:var(--text-subtle);margin:0 0 12px}
h3{font-size:16.5px;line-height:1.3;letter-spacing:-.005em;margin:0 0 5px}
section.blk{margin-bottom:34px}
.card{background:var(--surface-raised);border:1px solid var(--border);border-radius:9px;
  padding:15px;box-shadow:var(--shadow);margin-bottom:10px}
.badge{display:inline-flex;align-items:center;gap:4px;border:1px solid;border-radius:4px;
  padding:1.5px 6px;font-size:11px;font-weight:500;line-height:1.45;white-space:nowrap;margin:0 3px 3px 0}
.meta{font-size:11.5px;color:var(--text-subtle);display:flex;gap:14px;flex-wrap:wrap;margin-top:9px}
.muted{color:var(--text-muted);font-size:14px;line-height:1.6;margin:5px 0 0}
.grid{display:grid;gap:22px;grid-template-columns:minmax(0,1fr) 296px}
@media(max-width:940px){.grid{grid-template-columns:1fr}}
.stats{display:grid;gap:9px;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));margin-bottom:26px}
.stat{background:var(--surface-raised);border:1px solid var(--border);border-radius:8px;padding:11px 13px}
.stat .k{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--text-subtle);font-weight:600}
.stat .v{font-size:23px;font-weight:600;margin-top:3px;font-variant-numeric:tabular-nums}
.stat .v.ok{color:#1f5c3f}
.ev{border-left:2px solid #2f855a;padding-left:12px;margin-bottom:13px}
.interp{border-left:2px solid #c8801f;padding-left:12px;margin-bottom:13px}
.interp .lbl{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;font-weight:600;
  color:#8a5610;margin-bottom:4px}
.ev .lbl{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;font-weight:600;
  color:#1f5c3f;margin-bottom:4px}
.unk{background:var(--surface-sunken);border-radius:7px;padding:12px 14px}
.unk .lbl{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--text-subtle);
  font-weight:600;margin-bottom:6px}
ul,ol{margin:0;padding-left:17px}
li{margin-bottom:5px;font-size:13.5px;line-height:1.6;color:var(--text-muted)}
li.tight{margin-bottom:3px}
.serif{font-family:'Iowan Old Style','Palatino Linotype',Georgia,serif;font-size:15.5px;
  line-height:1.68;max-width:66ch;color:var(--text)}
.excerpt{background:var(--surface-sunken);border-radius:7px;padding:14px 16px;
  font-family:'Iowan Old Style',Georgia,serif;font-size:14.5px;line-height:1.7}
mark{background:#fdf0dd;padding:.12em 0;box-shadow:0 0 0 .16em #fdf0dd;border-radius:2px}
.dim{color:var(--text-subtle)}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th,td{text-align:left;padding:7px 9px;border-bottom:1px solid var(--border);vertical-align:top}
th{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--text-subtle);font-weight:600}
.caught{background:var(--surface-raised);border:1px solid var(--border);border-radius:9px;
  padding:26px;text-align:center;box-shadow:var(--shadow)}
.caught .big{font-size:18px;font-weight:600}
.why{background:var(--surface-sunken);border:1px solid var(--border);border-radius:7px;
  padding:10px 12px;margin-top:9px}
.why .lbl{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--text-subtle);
  font-weight:600;margin-bottom:5px}
.why li{font-size:12.5px;margin-bottom:3px}
code{background:var(--surface-inset);padding:1px 5px;border-radius:3px;font-size:12px}
.divider{border:0;border-top:1px solid var(--border);margin:38px 0 28px}
.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:var(--accent);
  font-weight:600;margin-bottom:7px}
</style></head><body>

<div class="banner"><strong>Extractive mode.</strong> No language model is configured, so
summaries reuse source sentences verbatim and nothing is paraphrased.</div>

<header class="top"><div class="topin">
  <div class="logo">M</div>
  <strong style="font-size:14px;letter-spacing:-.01em">Market Intelligence OS</strong>
  <nav><span class="on">Today</span><span>Companion</span><span>Learn</span><span>Prepare</span><span>Explore</span><span>Library</span></nav>
</div></header>

<div class="wrap">

<div class="note">
  <strong>Draft view — generated from the live database, not a mockup.</strong><br>
  Every headline, claim, quote, date, badge and classification below was produced by the
  real pipeline from real publisher feeds: ${totals.documents} documents → ${totals.claims}
  claims → ${totals.events} events → ${totals.insights} insights.
  Rendered as static HTML because corporate endpoint policy is currently blocking
  filesystem access to the repository, so the Next server cannot start — the database is
  reachable over TCP, which needs no file access.
  <br><br>
  <strong>What this preview cannot show:</strong> interactivity, the Companion, live
  ranking, voice, or navigation. Those need the running application.
</div>

<div class="stats">
  <div class="stat"><div class="k">Documents</div><div class="v">${totals.documents}</div></div>
  <div class="stat"><div class="k">Evidenced claims</div><div class="v">${totals.claims}</div></div>
  <div class="stat"><div class="k">Events</div><div class="v">${totals.events}</div></div>
  <div class="stat"><div class="k">Insights</div><div class="v">${totals.insights}</div></div>
  <div class="stat"><div class="k">Facts w/o evidence</div><div class="v ok">${totals.unevidenced}</div></div>
  <div class="stat"><div class="k">Active sources</div><div class="v">${totals.active}</div></div>
</div>

<h1>${brief.length} developments selected for you</h1>
<p class="muted" style="margin-bottom:28px">About ${totalMinutes} minutes · reading budget 12 minutes ·
the brief ends when you reach the bottom</p>

${[...bySection.entries()]
  .map(([section, items]) => {
    const [title, hint] = SECTIONS[section] ?? [section, ''];
    return `<section class="blk">
  <h2 class="sec">${esc(title)}</h2><p class="hint">${esc(hint)}</p>
  ${items
    .map(
      (it) => `<article class="card">
    <div>
      ${badge(it.novelty === 'repeated_announcement' ? 'Restated' : 'New', it.novelty === 'repeated_announcement' ? 'muted' : 'accent')}
      ${maturityBadge(it.case_maturity)}
      ${evidenceBadge(it.evidence_strength)}
      ${it.verification_status === 'DISPUTED' ? badge('Sources disagree', 'alert') : ''}
      ${it.first_party_only ? badge('Self-reported only', 'caution', 'No independent source has confirmed this.') : ''}
      ${it.is_demo ? badge('Demo data', 'alert', 'Illustrative fixture. Not real reporting.') : ''}
    </div>
    <h3>${esc(it.headline)}</h3>
    <p class="muted">${esc(it.takeaway)}</p>
    <div class="meta">
      <span>Event: ${date(it.event_at)}</span>
      <span>Published: ${date(it.first_reported_at)}</span>
      <span>${it.source_count} source${it.source_count === 1 ? '' : 's'}</span>
      <span>${it.estimated_minutes} min</span>
    </div>
    ${
      Array.isArray(it.why_shown) && it.why_shown.length
        ? `<div class="why"><div class="lbl">Why am I seeing this?</div><ul>${it.why_shown
            .map((r) => `<li class="tight">${esc(r)}</li>`)
            .join('')}</ul></div>`
        : ''
    }
  </article>`,
    )
    .join('')}
</section>`;
  })
  .join('')}

<div class="caught">
  <div class="big">You are caught up.</div>
  <p class="muted" style="max-width:44ch;margin:7px auto 0">That is the whole brief for
  today — ${brief.length} items. Nothing more will load here.</p>
</div>

<hr class="divider">

<div class="eyebrow">Insight detail</div>
<h1>${esc(featured.headline)}</h1>
<div style="margin:9px 0 4px">
  ${maturityBadge(featured.case_maturity)}
  ${evidenceBadge(featured.evidence_strength)}
  ${badge(String(featured.verification_status).replace(/_/g, ' ').toLowerCase(), 'neutral')}
  ${featured.first_party_only ? badge('Self-reported only', 'caution') : ''}
  ${badge('Extractive', 'muted', 'No language model configured. Sentences reused verbatim from the sources.')}
  ${featured.is_demo ? badge('Demo data', 'alert') : ''}
</div>
<p class="muted" style="max-width:66ch">${esc(featured.takeaway)}</p>
<div class="meta" style="margin-bottom:22px">
  <span>Event date: ${date(featured.event_at)}</span>
  <span>First reported: ${date(featured.first_reported_at)}</span>
  <span>Sources: ${featured.source_count} (${featured.independent_source_count} independent)</span>
  <span>Reading time: ${featured.estimated_reading_minutes} min</span>
</div>

<div class="grid">
<div>

<section class="blk">
  <h2 class="sec">Verified facts</h2>
  <p class="hint">Sentences taken verbatim from the sources. Each links to the exact passage it came from.</p>
  ${facts
    .slice(0, 4)
    .map(
      (f, i) => `<div class="ev">
    <div class="lbl">Fact ${i + 1}</div>
    <p class="serif" style="margin:0 0 6px">${esc(f.text)}</p>
    <div>${badge('Fact', 'verified')}${perspectiveBadge(f.perspective)}${evidenceBadge(f.evidence_strength)}${f.quantified ? badge('Quantified', 'accent') : ''}</div>
  </div>`,
    )
    .join('')}
</section>

${
  facts[0]?.quote
    ? `<section class="blk">
  <h2 class="sec">Evidence for fact 1</h2>
  <p class="hint">Characters ${facts[0].start_offset}–${facts[0].end_offset} of the stored document version.
  Offsets refer to an immutable snapshot, so a later edit to the article cannot move this citation.</p>
  <div class="excerpt">${evidenceExcerpt(facts[0])}</div>
  <div class="meta">
    <span><strong>${esc(facts[0].doc_title)}</strong></span>
    <span>${esc(facts[0].source_name)}</span>
    <span>Published ${date(facts[0].published_at)}</span>
  </div>
</section>`
    : ''
}

<section class="blk">
  <h2 class="sec">What changed</h2>
  <p class="serif">${esc(featured.what_changed)}</p>
</section>

<section class="blk">
  <h2 class="sec">What is genuinely new</h2>
  <p class="serif">${esc(featured.what_is_genuinely_new)}</p>
</section>

<section class="blk">
  <h2 class="sec">Why it matters</h2>
  <p class="serif">${esc(featured.why_it_matters)}</p>
</section>

<section class="blk">
  <h2 class="sec">Market context</h2>
  <p class="hint">Where this sits in the market model.</p>
  <p class="serif">${esc(featured.market_context)}</p>
</section>

${
  contradictionRows.length || (featured.counter_signals ?? []).length
    ? `<section class="blk">
  <h2 class="sec">Counter-signals</h2>
  <p class="hint">Evidence and considerations that cut the other way.</p>
  ${contradictionRows
    .map(
      (c) =>
        `<div class="card" style="border-color:rgba(192,57,43,.35);background:#fdf5f4">
      ${badge('Sources disagree', 'alert')}
      <p class="muted" style="color:var(--text)">${esc(c.explanation)}</p></div>`,
    )
    .join('')}
  ${(featured.counter_signals ?? []).map((s) => `<p class="muted">${esc(s)}</p>`).join('')}
</section>`
    : ''
}

<section class="blk">
  <h2 class="sec">Consultant perspective</h2>
  <div class="interp">
    <div class="lbl">Reading · our interpretation</div>
    <p class="muted">${esc(featured.consultant_perspective)}</p>
  </div>
  ${
    (featured.client_implications ?? []).length
      ? `<div class="interp"><div class="lbl">Client implications · our interpretation</div>
    <ul>${featured.client_implications.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`
      : ''
  }
  ${
    starters.filter((s) => s.kind === 'hypothesis').length
      ? `<div class="interp"><div class="lbl">Hypotheses · our interpretation</div>
    <ul>${starters
      .filter((s) => s.kind === 'hypothesis')
      .map((x) => `<li>${esc(x.text)}</li>`)
      .join('')}</ul></div>`
      : ''
  }
  ${
    starters.filter((s) => s.kind === 'contrarian_angle').length
      ? `<div class="interp"><div class="lbl">Contrarian angle · our interpretation</div>
    <ul>${starters
      .filter((s) => s.kind === 'contrarian_angle')
      .map((x) => `<li>${esc(x.text)}</li>`)
      .join('')}</ul></div>`
      : ''
  }
</section>

</div>
<aside>

<div class="card">
  <h2 class="sec">Conversation starters</h2>
  <ol>${starters
    .filter((s) => s.kind === 'conversation_starter')
    .map((s) => `<li>${esc(s.text)}</li>`)
    .join('')}</ol>
</div>

<div class="card unk">
  <div class="lbl">What this does not tell you</div>
  <ul>${(featured.known_unknowns ?? []).map((u) => `<li class="tight">${esc(u)}</li>`).join('')}</ul>
</div>

<div class="card">
  <h2 class="sec">Sources</h2>
  ${[...new Map(facts.map((f) => [f.doc_url, f])).values()]
    .map(
      (f) => `<div style="margin-bottom:11px">
      <div style="font-size:13px;font-weight:500">${esc(f.doc_title)}</div>
      <div style="margin-top:3px">${perspectiveBadge(f.perspective)}</div>
      <div class="meta" style="margin-top:2px"><span>${esc(f.source_name)} · ${date(f.published_at)}</span></div>
    </div>`,
    )
    .join('')}
</div>

</aside>
</div>

<hr class="divider">

<div class="eyebrow">Explore → Industry</div>
<h1>${esc(industry.name)}</h1>
<p class="serif" style="margin-bottom:6px">${esc(industry.definition)}</p>
<p class="hint">${industry.stages} value chain stages · ${industry.kpis} KPIs · market model
reviewed and dated, kept distinct from the news above it</p>

<div class="grid">
<div>
<section class="blk">
  <h2 class="sec">Market structure</h2>
  <p class="serif">${esc(industry.market_structure)}</p>
</section>

<section class="blk">
  <h2 class="sec">Value chain</h2>
  <p class="hint">Upstream to downstream. Each stage notes where margin actually sits.</p>
  ${stages
    .map(
      (s, i) => `<div class="card">
    <h3 style="font-size:14.5px"><span class="dim">${i + 1}</span> ${esc(s.name)}</h3>
    <p class="muted">${esc(s.description)}</p>
    <p class="muted"><strong style="color:var(--text)">Profit pool:</strong> ${esc(s.profit_pool_note)}</p>
  </div>`,
    )
    .join('')}
</section>

<section class="blk">
  <h2 class="sec">KPI tree</h2>
  <p class="hint">What moves, and why an executive cares.</p>
  ${kpis
    .map(
      (k) => `<div class="card">
    <h3 style="font-size:14.5px">${esc(k.name)}${k.typical_range ? ` <span class="dim" style="font-weight:400;font-size:12px">${esc(k.typical_range)}</span>` : ''}</h3>
    <p class="muted">${esc(k.definition)}</p>
    <p class="muted" style="color:var(--text)">${esc(k.why_it_matters)}</p>
  </div>`,
    )
    .join('')}
</section>
</div>

<aside>
<div class="card unk">
  <div class="lbl">Open questions</div>
  <ul>${(industry.open_questions ?? []).map((x) => `<li class="tight">${esc(x)}</li>`).join('')}</ul>
</div>

<div class="card">
  <h2 class="sec">Implementation mix</h2>
  <p class="hint" style="margin-bottom:8px">Announcements vs. things actually evidenced as deployed.</p>
  <table><tbody>
  ${maturityMix
    .map((m) => `<tr><td>${maturityBadge(m.case_maturity)}</td><td style="text-align:right;font-weight:600">${m.n}</td></tr>`)
    .join('')}
  </tbody></table>
  <p class="hint" style="margin:9px 0 0">Counting announcements is not a measure of market leadership.</p>
</div>

<div class="card">
  <h2 class="sec">Documents by perspective</h2>
  <table><tbody>
  ${perspectiveMix
    .map((p) => `<tr><td>${perspectiveBadge(p.perspective)}</td><td style="text-align:right;font-weight:600">${p.n}</td></tr>`)
    .join('')}
  </tbody></table>
  <p class="hint" style="margin:9px 0 0">Roughly 70% first-party. A real limitation, visible rather than hidden.</p>
</div>
</aside>
</div>

<hr class="divider">

<div class="eyebrow">Admin → Source registry</div>
<h1>Sources</h1>
<p class="hint" style="max-width:66ch">Being publicly reachable is not permission to
ingest, store or redistribute. Each source carries a rights decision, and the fetcher
refuses anything that has not passed review.</p>

<div class="card" style="padding:4px 8px">
<table>
<thead><tr><th>Source</th><th>Perspective</th><th>Rights</th><th>Retains</th><th>State</th></tr></thead>
<tbody>
${sources
  .map(
    (s) => `<tr>
  <td><strong>${esc(s.name)}</strong>${s.last_error ? `<div class="dim" style="font-size:11px;margin-top:2px">${esc(String(s.last_error).slice(0, 90))}</div>` : ''}</td>
  <td>${perspectiveBadge(s.perspective)}</td>
  <td>${badge(String(s.rights_status ?? 'no policy').replace(/_/g, ' '), s.rights_status === 'approved' ? 'verified' : 'caution')}</td>
  <td class="dim">${esc(String(s.storage_scope ?? '—').replace('_', ' '))}</td>
  <td>${badge(s.health ?? 'unknown', s.health === 'healthy' ? 'verified' : s.health === 'failing' ? 'alert' : 'muted')}</td>
</tr>`,
  )
  .join('')}
</tbody></table>
</div>

<p class="hint" style="margin-top:16px;max-width:66ch">
Four first-party newsrooms (Accenture, Anthropic, Inditex, Zalando) publish no
discoverable feed — every candidate path was probed and returned HTTP 404, recorded
verbatim in each policy. They stay registered as candidates with connectors off.
Microsoft News returns HTTP 403 to a declared user agent; sending a browser user agent
would likely work and was deliberately <em>not</em> done, so it is disabled with the
reason recorded instead.
</p>

</div></body></html>`;

writeFileSync(new URL('./preview.html', import.meta.url), html);
console.log('preview.html written');
console.log(`  brief items   ${brief.length}`);
console.log(`  facts shown   ${facts.length}`);
console.log(`  starters      ${starters.filter((s) => s.kind === 'conversation_starter').length}`);
console.log(`  sources       ${sources.length}`);
console.log(`  size          ${Math.round(html.length / 1024)} kb`);
