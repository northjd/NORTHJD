# Patch — replace the term-overlap floor with a coverage gate

**File:** `packages/intelligence/src/companion.ts`
**Reason:** the relevance floor added earlier was wrong in both directions. Found while
building the interactive preview; measured, not guessed.

---

## What was wrong

The floor required a claim to contain a minimum share of query terms (2 of 4, etc.).

It **rejected correct evidence.** For "what is happening with markdown and allocation in
retail", every genuinely relevant claim scores overlap **1**, not 2:

```
overlap 1 | The company reported an 18% reduction in markdown rate across its European …
overlap 1 | Chief Operating Officer Lena Farkas said the system now generates allocation …
```

A single sentence rarely contains two distinct query concepts, so the floor threw away
exactly the claims it should have kept, and the Companion refused a question it could
answer.

## What was tried and rejected

**`ts_rank` with an absolute threshold.** Cannot work — rank is only comparable within
one query. Measured on this corpus:

| Question                          | Top rank   | Should |
| --------------------------------- | ---------- | ------ |
| markdown and allocation in retail | 0.0190     | answer |
| population of Ulaanbaatar         | **0.0304** | refuse |

The refusable question out-ranks the answerable one.

**Inverse document frequency.** Also fails on a 369-claim corpus: "population" appears
in 1 claim (0.3%) and is maximally "distinctive", yet the question is out of scope.

## What works

**Query coverage** — the share of query terms that appear _anywhere_ in the corpus.
Measured across ten cases:

| Question                          | Coverage | Should |
| --------------------------------- | -------- | ------ |
| markdown and allocation in retail | 100%     | answer |
| fashion retailers reduce markdown | 100%     | answer |
| NVIDIA report quarter             | 100%     | answer |
| AI deployment maturity            | 100%     | answer |
| EU textile traceability           | 100%     | answer |
| Uzbek textile mill revenue        | 38%      | refuse |
| population of Ulaanbaatar         | 50%      | refuse |
| 1974 World Cup final              | 60%      | refuse |
| melting point of tungsten carbide | 25%      | refuse |
| Bolivian cement cooperative       | 33%      | refuse |

Clean separation. Threshold **0.7**.

It also has a better failure message: a refusal can name the missing words, which is a
statement about coverage rather than about the question —
_"No monitored source mentions: Uzbek, mill, unlisted. Only 38% of this question's
vocabulary appears anywhere in the monitored sources."_

## Second fix: strip imperatives, not just interrogatives

"Challenge the claim that AI allocation reduces markdown" failed the gate because
_challenge_, _claim_ and _that_ are addressed to the assistant, not to the subject.
`QUESTION_NOISE` already stripped interrogatives for that reason; it now also strips
imperatives — tell, show, explain, brief, prepare, teach, challenge, compare, claim,
consider, assume, view, and the usual function words.

---

## Changes to make

**1.** Replace `relevanceFloor` with the coverage gate:

```ts
/**
 * Coverage gate.
 *
 * Answers "do the monitored sources contain the vocabulary of this question at all?",
 * as the share of query terms present anywhere in the corpus.
 *
 * A per-claim term-overlap floor was tried first and rejected correct evidence: a
 * single sentence rarely contains two distinct query concepts, so "markdown rate" and
 * "allocation proposals" were discarded. `ts_rank` cannot work either — it is only
 * comparable within one query, and "population of Ulaanbaatar" out-ranked a retail
 * question the sources can genuinely answer.
 */
const COVERAGE_THRESHOLD = 0.7;

async function queryCoverage(terms: string[]): Promise<{ coverage: number; missing: string[] }> {
  const missing: string[] = [];
  let present = 0;
  for (const term of terms) {
    const rows = await db()
      .select({ one: sql<number>`1` })
      .from(claims)
      .where(sql`${claims.searchVector} @@ websearch_to_tsquery('english', ${term})`)
      .limit(1);
    if (rows.length) present++;
    else missing.push(term);
  }
  return { coverage: terms.length ? present / terms.length : 0, missing };
}
```

**2.** In `retrieveClaims`, gate on coverage and relax the per-claim filter to `>= 1`:

```ts
const { coverage, missing } = terms.length
  ? await queryCoverage(terms)
  : { coverage: 1, missing: [] };
if (coverage < COVERAGE_THRESHOLD) return [];   // the honest refusal path

// … and in the filter chain, replace the floor comparison with:
.filter((r) => terms.length === 0 || termOverlap(r.text, terms) >= 1)
```

Return `{ coverage, missing }` alongside the claims so `insufficientEvidenceAnswer()`
can name the missing vocabulary.

**3.** Extend `QUESTION_NOISE` with the imperative list (see
`preview/server.mjs` for the exact array).

**4.** Add unit tests for the ten measured cases above, plus:

```ts
it('does not let imperative words count against coverage', …)
it('names the missing vocabulary when it refuses', …)
```

---

## Verified

15/15 cases behave correctly in the preview harness after both fixes — every mode
answers what it should and refuses what it should, including `challenge_me` on both an
in-scope and an out-of-scope claim.
