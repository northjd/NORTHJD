# Source Rights Model

**Publicly reachable is not permission to ingest, store or redistribute.**

That sentence is the whole model. This document describes how it is enforced in code
rather than observed as a policy.

---

## The gate

Every source has a `source_policies` row. `evaluateRights()` is consulted before any
connector runs, and it makes exactly two decisions:

1. **May we fetch this at all?**
2. **How much of what we fetch may we keep?**

```ts
evaluateRights(policy) → {
  allowed: boolean
  storageScope: 'metadata' | 'excerpt' | 'full_text'
  aiProcessingAllowed: boolean
  reason: string   // shown verbatim in the admin registry
}
```

With `INGEST_REQUIRE_RIGHTS_REVIEW=true` — the default, and the README says to leave it
alone — a **missing** policy is treated the same as a pending one: refused. Absence of
a decision is not consent.

The connector never sees the decision as advice. The pipeline refuses to invoke it, sets
connector health to `disabled`, and records the reason.

---

## Rights statuses

| Status | Fetch? | Retain |
|---|---|---|
| `approved` | yes | up to the policy's storage scope |
| `metadata_only` | yes | headline, link, dates — no body |
| `pending_review` | **no** | — |
| `restricted` | **no** | — |
| `denied` | **no** | — |

Belt and braces: the seed sets `isActive: connector.isActive && policy.allowedToIngest`,
so a connector cannot be active on a source whose policy forbids ingestion even if the
seed data were wrong. An evaluation invariant checks the live database for that
combination.

---

## Storage scope caps what is written

`applyStorageScope` is applied to every document *after* the connector returns, so what
gets written is capped by the policy regardless of what the connector produced:

| Scope | `normalizedText` | Evidence spans possible? |
|---|---|---|
| `full_text` | the body | yes |
| `excerpt` | a short extract | yes, short |
| `metadata` | **empty** | **no** |

`canExtractEvidence(scope)` returns false for `metadata`, and the pipeline skips claim
extraction entirely for those documents. A metadata-only source can still produce an
event — a headline and a date are facts about what was published — but it cannot
produce quoted evidence, and the UI must not imply otherwise.

---

## Review basis for the approved sources

Ten sources are approved. Each was checked on 2026-09-01 and the review note is stored
in the database and shown in the admin registry:

- it is a **publisher-operated RSS/Atom feed** — content the publisher deliberately
  made machine-readable for syndication
- its host's **`robots.txt` was retrieved** and contains no rule disallowing the feed
  path for a generic user agent
- **only what the feed returns is stored.** The article link is never followed — that
  would be scraping under a different name, and publishing a feed does not license it
- **attribution and a link to the original** appear on every derived item
- retention is `excerpt`: the feed's own summary, not an article body

Two carry additional terms: Retail Dive requires publisher attribution, which is
rendered on every citation; McKinsey is marked `FIRST_PARTY_CONSULTING_FIRM` so its
claims can never count as independent confirmation.

Institutional sources were reviewed on their own footing — European Commission
documents are reusable under the Commission's reuse policy with acknowledgement, and US
federal works are generally not subject to domestic copyright.

---

## What is deliberately not done

No code path bypasses any access control. Specifically, nowhere in this codebase:

- circumvents a paywall, login or bot-detection mechanism
- follows an article link from a feed to retrieve full text
- scrapes a page that has not been individually reviewed and approved
- stores full text for a source approved only for excerpts
- redistributes content where the policy does not permit it

Four first-party newsrooms publish no discoverable feed (Accenture, Anthropic, Inditex,
Zalando). Every candidate path was probed and returned HTTP 404, and the probe results
are recorded verbatim in each policy's review note. They stay registered as
**candidates with connectors off**. Enabling one requires a confirmed publisher feed URL
and a terms review — not a scraper.

**Microsoft News is the instructive case.** Its feed returned HTTP 200 to a probe and
then HTTP 403 to the pipeline's declared user agent. Sending a browser user agent would
very likely have worked. That was not done: defeating an access control by
misrepresenting the client is evasion, whatever the technical ease. The connector is
disabled with `HTTP 403` recorded as the reason, and the source appears in the coverage
dashboard as a gap.

That decision costs real coverage. It is the correct one, and it is the kind of choice
that has to be made the same way when nobody is checking.

---

## Politeness

Self-imposed, independent of what the host permits:

- `rate_limit_per_hour` per source (4–12 for institutional feeds, 30 for manual URLs)
- an identifying, contactable `User-Agent` with a contact field in `.env.example`
- conditional GET via stored ETag — an unchanged feed costs a 304, not a full body
- `INGEST_TIMEOUT_MS` and `INGEST_MAX_BYTES` ceilings
- `INGEST_ENABLED=false` as a global kill switch

---

## Manual URL ingestion

A user asserting they may share a page is a different legal basis from a publisher
offering a feed, so this path is treated differently:

- one page, fetched once, on explicit submission — **no crawling, no link following**
- perspective `USER_PROVIDED`, so nothing ingested this way is ever presented as
  independently verified, and it can never corroborate another source
- retention limited to an excerpt for identification
- the submission is recorded in the audit log
- the same SSRF guards apply, because a user-supplied URL is attacker-controlled input

---

## Tier 4 — internal sources

Schema and perspective (`AUTHORIZED_INTERNAL`) exist. **Nothing is implemented**, and
that is deliberate. Internal research, account plans, approved presentations, SharePoint,
Teams and CRM all require explicit approval and permission-aware retrieval before a
single document is read.

This deployment contains no confidential Accenture or client data. It uses public
sources, labelled demo data and user-provided non-sensitive content only, and the
Companion carries a standing warning against entering client-confidential information.

---

## Reviewing a new source

1. Look for an **official feed or API** first. If there is one, that is the answer.
2. If there is not, check whether structured data is offered under stated terms.
3. Retrieve `robots.txt`; record the date and what it says about the intended path.
4. Read the terms of use for automated access and redistribution.
5. Record a policy row with the flags, the storage scope, required attribution, a rate
   limit and a **review note explaining the decision in your own words**.
6. If anything is unclear, leave `pending_review`. An unreviewed source contributes
   nothing; an improperly ingested one is a liability.
7. Consider `metadata_only` as a middle path — a headline, a link and a date are often
   enough to know something happened.

The review note matters as much as the flags. Six months from now, "why is this source
off?" needs an answer better than a status enum.
