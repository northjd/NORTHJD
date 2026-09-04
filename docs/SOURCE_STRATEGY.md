# Source Strategy

The platform does not try to out-collect professional news providers. The defensible
layer is what sits on top: selection, consolidation, framing, personalisation, learning
connection and conversation application, over whatever is lawfully available.

---

## Tiers

**Tier 1 — Primary and official.** Company newsrooms, investor relations, regulatory
filings, regulators, government institutions, official technology blogs, research
institutions, annual reports, earnings releases.

_Active:_ NVIDIA, Google, OpenAI, Meta, AWS ML Blog, H&M Group, European Commission,
NIST. _Registered, not running:_ SEC EDGAR (connector not implemented), Accenture,
Anthropic, Inditex, Zalando (no discoverable feed).

**Tier 2 — Independent.** Reputable business, technology and industry media; academic
and research organisations.

_Active:_ Retail Dive. **One source is not enough** — see the gap below.

**Tier 3 — Licensed premium.** Connector interfaces exist. **Nothing implemented**, and
nothing should be until a licence exists.

**Tier 4 — Authorised internal.** Schema and `AUTHORIZED_INTERNAL` perspective exist.
**Nothing implemented.** Requires explicit approval and permission-aware retrieval
before a single document is read.

---

## Why the mix matters more than the count

Ten sources, chosen so the trust model has something to work with:

| Perspective            | Sources | What it enables                                              |
| ---------------------- | ------- | ------------------------------------------------------------ |
| First-party vendor     | 5       | Announcements at source, correctly labelled as self-reported |
| First-party company    | 1       | Retail/fashion company news                                  |
| Trade press            | 1       | **The only thing that can corroborate anything**             |
| Regulator              | 1       | Primary evidence on regulation                               |
| Public institution     | 1       | Standards and measurement                                    |
| First-party consulting | 1       | Firm moves, marked so they never count as independent        |

Without an independent source, nothing could ever be corroborated and the platform would
only be able to repeat what companies say about themselves. That is why one trade
publication was worth more than a sixth vendor blog — and why adding two or three more
is the second priority in the next steps.

---

## The coverage gaps, named

| Gap                            | Consequence                                                                                | Fix                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| **No regulatory filings**      | Missing the best available primary evidence: legally attested rather than self-promotional | Implement the EDGAR filing connector. Rights are already fine |
| **One independent source**     | Corroboration is structurally rare, so most events sit at `SINGLE_SOURCE`                  | Add 2–3 independent business media feeds                      |
| **Feed summaries only**        | Evidence spans are short; claim extraction has little text to work with                    | Licensed full-text, or accept the limit                       |
| **English only in practice**   | European and Asian coverage is thin despite multilingual support in the model              | Add non-English feeds; language detection per document        |
| **No paywalled reporting**     | The best business journalism is absent                                                     | Licence, or accept                                            |
| **Four newsrooms unavailable** | Accenture, Anthropic, Inditex, Zalando produce no visible signal                           | Confirm feed URLs, or leave as gaps                           |

All six are listed in the coverage dashboard. A gap the user can see is manageable; one
they cannot is a source of false confidence.

---

## Connector types

**Implemented:** RSS/Atom, manual URL, demo fixtures.

**Prepared, not implemented** — listed in admin so the reader does not have to guess:
REST API, GraphQL API, filing API, licensed feed, sitemap discovery, structured page
extraction, uploaded document, webhook, MCP.

---

## Adding a source

1. Look for an official feed or API first. If there is one, that is the answer.
2. Probe it. Record the result — including a 404, which is itself useful information.
3. Retrieve `robots.txt`; record the date and what it says about the intended path.
4. Read the terms for automated access and redistribution.
5. Classify the perspective honestly. A vendor blog describing a customer deployment is
   `FIRST_PARTY_TECH_PROVIDER`, not independent evidence about the customer.
6. Write the policy with flags, storage scope, attribution, rate limit and a review note
   in your own words.
7. If anything is unclear, leave `pending_review`.

Prefer, in order: official feeds and APIs → structured public data → manual URL import →
nothing. There is no step that involves scraping a page that has not been individually
reviewed.
