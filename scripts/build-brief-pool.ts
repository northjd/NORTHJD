/**
 * Writes the brief's candidate pool to a static file, so Today can be personal.
 *
 * The brief is composed once, at build time, on a machine that has never met you. That is
 * fine for the hosted build, where the ranking context comes from your profile row — but
 * the static export has no profile rows and no server, so every visitor was being handed
 * a brief assembled for nobody. The set-up questions were written to localStorage and
 * then read by nothing at all.
 *
 * Shipping the pool fixes that without a server: the browser has the same candidates the
 * server build had, and runs the same `scoreItem` and `composeBrief` over them with a
 * context built from your own answers. Same code, same weights, same "why am I seeing
 * this?" sentences — the only difference is where it runs.
 *
 * Entity ids travel with their slugs because ranking matches on id and localStorage
 * stores slugs; without the map, choosing a company would score nothing.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from '@mios/database';
import { getCandidateInsights } from '../apps/web/src/lib/queries';

const out = resolve(import.meta.dirname, '../apps/web/public');
mkdirSync(out, { recursive: true });

const [workspace] = (
  await db().execute(sql`select id from workspaces order by created_at asc limit 1`)
).rows as { id: string }[];

if (!workspace) {
  console.error('[brief-pool] no workspace; run db:seed first');
  process.exit(1);
}

const candidates = await getCandidateInsights(workspace.id);

const entities = (await db().execute(sql`select id, slug, name from entities order by name asc`))
  .rows as { id: string; slug: string; name: string }[];

/**
 * Learning units, so "Learn one thing" survives client-side composition.
 *
 * Composed the same way the server does it — first unit not yet completed — except that
 * in a build with no accounts nothing is ever completed, so the browser picks by position
 * and rotates on the day. It is the one section that is not evidence, and losing it would
 * quietly drop the Depth half of the product from a personalised brief.
 */
const learningUnits = (
  await db().execute(sql`
    select slug, title, objective, estimated_minutes as "estimatedMinutes", position
      from learning_units
     order by position asc
     limit 24
  `)
).rows as {
  slug: string;
  title: string;
  objective: string;
  estimatedMinutes: number;
  position: number;
}[];

const items = candidates.map((c) => ({
  insightId: c.insightId,
  eventId: c.eventId,
  headline: c.headline,
  takeaway: c.takeaway,
  novelty: c.novelty,
  estimatedMinutes: c.estimatedMinutes,
  isDemo: c.isDemo,
  eventAt: c.eventAt ? new Date(c.eventAt).toISOString() : null,
  firstReportedAt: c.firstReportedAt ? new Date(c.firstReportedAt).toISOString() : null,
  strategicImpact: c.strategicImpact,
  evidenceStrength: c.evidenceStrength,
  caseMaturity: c.caseMaturity,
  verificationStatus: c.verificationStatus,
  sourceCount: c.sourceCount,
  independentSourceCount: c.independentSourceCount,
  firstPartyOnly: c.firstPartyOnly,
  industrySlugs: c.industrySlugs,
  topicSlugs: c.topicSlugs,
  technologySlugs: c.technologySlugs,
  entityIds: c.entityIds,
  conceptSlugs: c.conceptSlugs,
}));

const file = resolve(out, 'brief-pool.json');
const payload = JSON.stringify({
  generatedAt: new Date().toISOString(),
  items,
  entities,
  learningUnits,
});
writeFileSync(file, payload);
console.log(
  `[brief-pool] ${items.length} candidates · ${entities.length} entities · ${(
    payload.length / 1024
  ).toFixed(0)} KB`,
);
process.exit(0);
