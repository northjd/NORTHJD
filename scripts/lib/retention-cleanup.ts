/**
 * The rows a document deletion leaves behind that nothing else reaches.
 *
 * Deleting a `raw_documents` row cascades a long way — versions, claims, evidence spans,
 * `event_claims`, `event_documents` — but a cascade only ever deletes rows that point at
 * what went. It cannot delete a row that is now *wrong* because of what went, and there
 * are two of those.
 *
 * The first was already handled: an event whose last document is gone survives as an
 * assertion with nothing under it, so retention deletes it.
 *
 * The second was not, and it is the one that stopped the site publishing twice in eight
 * days. An event can keep a document while every *claim* linked to it came from
 * documents that were deleted. `event_claims` is emptied by the cascade, the event is
 * still anchored by its surviving document so the orphan rule does not see it, and its
 * insight — our interpretation, presented as reading the evidence — is left tracing back
 * to nothing. `npm run eval` fails the build over exactly that, which is correct: the
 * one thing this product must not do is show an unevidenced reading. But the violation
 * was created by retention, so retention is where it should be prevented.
 *
 * Measured on a 1,752-document corpus: 266 of 1,733 non-demo events already have no
 * linked claim at all, and 631 insights sit on the other 1,467. Nothing was failing at
 * that moment; whether a given build failed depended on whether one of the deleted
 * documents happened to carry the last claim of an event that happened to have an
 * insight. That is a race, not a rare corruption, and it was being rolled several
 * hundred documents at a time on every run.
 */

import { sql, type SQL } from 'drizzle-orm';

/**
 * Deletes insights whose event can no longer show an evidenced claim, and counts them.
 *
 * Demo material is reached through its event rather than a flag of its own: a demo
 * insight belongs to a demo event, and `e.is_demo = false` is what keeps the seeded
 * fixtures out of this. That guard is not decoration — deleting demo rows from a local
 * database is a mistake this project has already made once, and it presents as a test
 * regression with no cause in the diff.
 *
 * The event itself stays. It still has a document and can still show it; an event with
 * no claims is thin, not unevidenced, and 15% of the corpus is in that state normally.
 */
export function deleteUnevidencedInsights(): SQL {
  return sql`
    with gone as (
      delete from insights i
       using events e
       where e.id = i.event_id
         and e.is_demo = false
         and not exists (
           select 1 from event_claims ec
             join claim_evidence ce on ce.claim_id = ec.claim_id
            where ec.event_id = i.event_id
         )
      returning 1
    )
    select count(*)::int as n from gone`;
}

/** The same condition as a count, for asserting the invariant without deleting. */
export function countUnevidencedInsights(): SQL {
  return sql`
    select count(*)::int as n
      from insights i
      join events e on e.id = i.event_id
     where e.is_demo = false
       and not exists (
         select 1 from event_claims ec
           join claim_evidence ce on ce.claim_id = ec.claim_id
          where ec.event_id = i.event_id
       )`;
}
