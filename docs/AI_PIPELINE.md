# AI Pipeline

Twenty-five conceptual stages, of which sixteen are implemented. Each implemented stage
writes a `pipeline_stage_runs` row with counts and rejection reasons, so a bad run is
diagnosable rather than mysterious.

---

## Stages

| #   | Stage                     | State           | Method                                                      |
| --- | ------------------------- | --------------- | ----------------------------------------------------------- |
| 1   | Source discovery          | Manual          | Feeds probed and reviewed by hand; recorded in the registry |
| 2   | Rights validation         | **Implemented** | `evaluateRights` before any fetch                           |
| 3   | Ingestion                 | **Implemented** | SSRF-guarded fetcher, conditional GET via ETag              |
| 4   | Document versioning       | **Implemented** | Content hash; new version on material change                |
| 5   | Metadata extraction       | **Implemented** | Feed fields; og/meta tags for manual URLs                   |
| 6   | Language detection        | Partial         | Source-declared; no per-document detection                  |
| 7   | Content normalisation     | **Implemented** | `normalizeText`, idempotent, offset-defining                |
| 8   | Duplicate detection       | **Implemented** | Token fingerprint plus per-source URL uniqueness            |
| 9   | Entity extraction         | **Implemented** | Alias matching against the seeded entity set                |
| 10  | Entity resolution         | **Implemented** | Ambiguity guard requiring corroboration                     |
| 11  | Topic classification      | **Implemented** | Whole-word taxonomy matching                                |
| 12  | Capability classification | **Implemented** | Same mechanism                                              |
| 13  | Claim extraction          | **Implemented** | Sentence-level, verbatim, offset-exact                      |
| 14  | Evidence-span linking     | **Implemented** | Written in the same transaction as the claim                |
| 15  | Event extraction          | **Implemented** | Type and maturity classification                            |
| 16  | Event clustering          | **Implemented** | Shared entities + time window + text overlap                |
| 17  | Contradiction detection   | **Implemented** | Numeric and negation conflicts                              |
| 18  | Maturity classification   | **Implemented** | Asymmetric hype filter                                      |
| 19  | Signal generation         | Partial         | Placement recorded; **no curated trends to attach to**      |
| 20  | Insight generation        | **Implemented** | Assembled from claims and taxonomy                          |
| 21  | Learning connection       | **Implemented** | Taxonomy match → concept                                    |
| 22  | Conversation application  | **Implemented** | Parameterised templates                                     |
| 23  | Personalisation           | **Implemented** | At brief-composition time, in `packages/ranking`            |
| 24  | Briefing generation       | **Implemented** | Finite, stored once per day                                 |
| 25  | Quality evaluation        | **Implemented** | 15 invariants, CLI and admin                                |

---

## The rule about when to use a model

**Do not use an LLM for anything a deterministic method does reliably.**

Applied here: sentence splitting, offset computation, fingerprinting, duplicate
detection, alias matching, date parsing, whole-word taxonomy matching, numeric conflict
detection and every threshold comparison are all deterministic. They are cheaper, faster,
testable and cannot hallucinate.

What a model would genuinely add is prose quality in the interpretive sections, better
conversation starters, and paraphrase-tolerant clustering. Those are the parts currently
served by templates and lexical overlap — and the parts labelled _Extractive_.

---

## Model output contract

Where a model is configured, its output must be:

- **structured** — a constrained tool call, not prose to be parsed
- **schema-validated** — Zod, with one retry that feeds the errors back and explicitly
  instructs against inventing facts to satisfy the schema
- **versioned** — `prompt_version_id` and model configuration recorded on the row
- **evidence-linked** — every factual statement references a claim with an evidence span
- **checked before display** — `assertEvidenceIntegrity`

On failure: fall back to extractive. **No factual insight is published when schema or
evidence validation fails.** Failing closed is the design.

Cost is recorded per call in `ai_usage` with a per-run ceiling (`AI_MAX_USD_PER_RUN`).

---

## Source content is never instruction

Ingested text is wrapped in an untrusted-content envelope before reaching a model, and
instructions found inside a document are ignored by design. The structural defence
matters more: a successful injection cannot attach a real evidence span to a fabricated
claim, so the worst case is a discarded response.

---

## Idempotency

Every stage is safe to re-run:

- documents are unique per (source, canonical URL)
- versions are only added on material change
- evidence spans are unique per (version, start, end) with `onConflictDoNothing`
- claims are extracted only for versions that have none
- events are built only for documents not yet clustered
- insights are unique per (workspace, event)

`--rebuild` regenerates insights from stored events without re-fetching, which is how
the generation layer can be changed and compared without touching ingestion.

---

## Observability

`pipeline_runs` holds aggregate counters and cost; `pipeline_stage_runs` holds per-stage
items in/out/rejected with reasons; `import_jobs` holds per-connector results with
warnings. Connector health carries `last_success_at`, `last_failure_at`, `last_error`
and consecutive failures. All of it surfaces in admin.

A run reports what it fetched, what it skipped, and **which sources it refused along
with the reason** — a refusal is a result, not an error to be hidden.

---

## Performance

A full run over ten feeds: ~8–20 seconds for ~191 documents, ~369 claims, ~185 events,
~184 insights. Clustering is O(n²) on the batch, which is fine at hundreds and would
need blocking by entity or date at tens of thousands.
