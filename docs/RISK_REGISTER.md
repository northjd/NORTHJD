# Risk Register

Ordered by what would actually damage the product or its user. Likelihood and impact are
judgements, not measurements.

---

## Product risks

### R1 — False confidence *(high impact, medium likelihood)*
A consultant repeats something to a client that the platform presented as established
and is not. The single most damaging failure available: it costs credibility in a room,
which is the currency of the job.

**Mitigations:** the whole evidence model — claim-level citations, four-layer integrity
enforcement, perspective badges, maturity ladder, computed known-unknowns, honest
refusal, visible contradictions.

**Residual:** extraction is lexicon-based, so a sentence could be misclassified as
`FACT`. Evidence linkage means the user can always check, but the badge is the first
thing read. The mitigation is that classification errors degrade toward
`UNVERIFIED_SIGNAL`, not toward `FACT`.

### R2 — Misleading completeness *(high impact, high likelihood without mitigation)*
The user infers that ten monitored sources represent the market.

**Mitigations:** coverage dashboard with a named-gaps section; monitored-source count in
every insight's known-unknowns; "No new events were found in the currently monitored
sources" rather than "nothing happened"; "a thin timeline means limited monitoring".

**Residual:** roughly 70% of documents are first-party. Every individual item is
labelled, but the *aggregate* skew is only visible if someone looks at the coverage page.

### R3 — First-party bias *(medium impact, high likelihood)*
Vendor and company newsrooms dominate, so the platform's picture of the world is largely
what companies say about themselves.

**Mitigations:** perspective on every source and citation; independence as an allow-list;
`firstPartyOnlyPenalty` in ranking; "Self-reported only" badge; corroboration counted
separately.

**Residual:** real and unresolved. One independent source. Adding two or three more is
the second priority in the next steps — this is the risk that fix addresses.

### R4 — Filter bubble *(medium impact, medium likelihood)*
Relevance ranking converges on what the user already believes matters.

**Mitigations:** one reserved adjacent slot, selected before discretionary sections;
knowledge-gap weighting; exploration budget; Challenge Me.

**Residual:** one slot out of eight. Better than none; not a solution.

### R5 — Extractive prose reads as machine-assembled *(low impact, certain)*
It does, and the UI says so. Accepted deliberately: the alternative was generating
plausible text without a model.

---

## Technical risks

### R6 — PGlite is not a production database *(high impact if mistaken for one)*
Single connection, WASM, file-backed.

**Mitigations:** ADR 0001 states it; README states it; the server prints it on startup;
`DATABASE_URL` swaps to managed PostgreSQL with no code change.

### R7 — Dev-server hydration failure *(medium impact, environment-dependent)*
Where Next's HMR WebSocket upgrade is blocked, pages render but never hydrate. The
symptom is deceptive: everything looks right and nothing works.

**Mitigations:** documented in README and STATUS; e2e targets the production server;
verified that `next start` hydrates correctly.

### R8 — Lexical clustering misses paraphrases *(medium impact, high likelihood)*
Two reports sharing no vocabulary stay separate, so the brief shows the same event twice.

**Mitigations:** the two-shared-entities rule catches the common case; fingerprinting
catches near-identical text.

**Residual:** real. Embeddings would help and are interface-only.

### R9 — Single-source connector fragility *(low impact, high likelihood)*
Feeds move, change format, or start returning 403 — Microsoft already did.

**Mitigations:** per-connector health, consecutive-failure counts, last error surfaced in
admin; one failure never blocks the run.

### R10 — Corporate endpoint policy blocks filesystem access *(realised)*
Not hypothetical: it happened mid-session. GlobalProtect plus Tanium on the client VPN
caused macOS to deny access to `~/Desktop`, which is where the repository lives.

**Mitigation:** work staged outside the protected folder with an apply script.
**Longer-term:** keep the repository outside `~/Desktop` and `~/Documents`.

---

## Legal and compliance risks

### R11 — Ingesting content without the right to *(high impact, low likelihood)*
**Mitigations:** rights gate refusing by default; storage scope capping retention; feed
bodies only, never following the article link; robots.txt checked and dated; review note
per source; no paywall or access-control bypass anywhere; **no user-agent spoofing even
where it would have worked** — Microsoft News is disabled rather than worked around.

**Residual:** terms change. Review dates are recorded but nothing re-checks them.

### R12 — Confidential data entering a non-approved workspace *(high impact, medium likelihood)*
A user pastes client material into the Companion.

**Mitigations:** standing warning on every Companion mode; notes stored separately and
never citable; no internal connectors implemented.

**Residual:** a warning is not a control. Real prevention needs DLP and an approved
workspace classification — listed as a prerequisite in SECURITY_AND_PRIVACY.

### R13 — Personal data in transcripts and knowledge state *(medium impact)*
**Mitigations:** browser-only voice by default so no audio reaches the server; audio not
persisted; transcripts deleted with the conversation; knowledge state visible and
correctable.

**Residual:** no DPIA; no automated retention enforcement.

---

## Security risks

### R14 — Prompt injection via ingested content *(medium impact, high likelihood of attempt)*
**Mitigations:** untrusted-content envelope; and structurally, model output must pass
schema validation and evidence integrity — so an injection cannot attach a real evidence
span to a fabricated claim. Worst case is a discarded response.

### R15 — SSRF via manual URL ingestion *(high impact, low likelihood)*
**Mitigations:** DNS resolved and checked before connecting; every redirect hop
re-validated; private, loopback, link-local, CGNAT and IPv4-mapped-IPv6 ranges blocked;
scheme allow-list; streaming byte ceiling. Unit-tested including a regression for an
over-broad range.

### R16 — Rate limiting is in-memory *(low impact currently)*
Honestly labelled in the code as not a security boundary. Ineffective across instances.

---

## Delivery risks

### R17 — Missing credentials mistaken for missing capability *(medium impact)*
**Mitigations:** capability status distinguishing live / fallback / not configured /
blocked-by-credentials / not implemented, with a one-sentence explanation each; a
persistent banner in extractive mode.

### R18 — Documentation drifting from behaviour *(medium impact, high likelihood)*
Twenty-plus documents describing a system that changes.

**Mitigations:** invariants are code rather than prose; STATUS.md carries verified
numbers; the acceptance criteria state their evidence.

**Residual:** the documents will drift. The ones that matter — trust model, rights model
— are backed by tests that fail if the behaviour changes.

---

## The three worth watching

1. **R3, first-party bias.** Structural, currently unresolved, and fixed by adding
   independent sources rather than by more code.
2. **R2, misleading completeness.** Mitigated per item; the aggregate skew is easy to
   miss.
3. **R12, confidential data.** A warning where a control is needed. Do not cross into
   client material without the prerequisites.
