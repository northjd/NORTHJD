# Ranking Model

Two properties matter more than the scoring maths: **explainability** and
**neutrality**. Both are structural, and both are tested.

---

## Explainability

Every scoring component that fires contributes a human-readable sentence, and the
"Why am I seeing this?" panel is assembled from those sentences — not written
separately. The panel cannot drift from the scoring that actually happened, because it
*is* the scoring output.

```ts
scoreItem(item, ctx) → { score, components, reasons }
```

`components` is the per-term contribution, for the admin inspector. `reasons` is what
the user sees:

> - It is in fashion-apparel, which you follow.
> - It involves a company on your watchlist.
> - It is new since your last visit.
> - Only the company itself has reported this so far.
>
> *No company or firm receives a ranking bonus for being itself.*

Note that reasons include the unflattering ones. "Only the company itself has reported
this" and "this restates an earlier announcement rather than adding anything" both
appear, because a ranking explanation that only lists reasons to be interested is
marketing.

A flat, inspectable weights object rather than a learned model — deliberately. A
consultant must be able to see why an item was chosen and disagree with it.

---

## Neutrality

`WEIGHTS` contains no entity-specific term. There is no branch on company, firm or
source identity anywhere in the scoring path.

```ts
scoreIsEntityNeutral(item, ctx, substituteEntityId)
```

Scores an item, re-scores it with a different entity, and compares — excluding the
legitimately relevance-driven terms (watchlist, account, mission), because *following*
a company should raise its items. That is a user preference, not a bias.

Asserted in three places: a unit test, an evaluation invariant, and a second evaluation
case that scans live brief items for any company-specific section name.

An item about Accenture and an equivalent item about H&M score identically. Consulting
firms are ordinary entities.

---

## Components

| Weight | Term | Fires when |
|---|---|---|
| 2.6 | `accountMatch` | Involves one of the user's accounts |
| 2.2 | `watchlistMatch` | Involves a watched company |
| 2.0 | `strategicImpact` | Scaled by the event's assessed impact |
| 1.8 | `missionMatch` | Relevant to the active mission |
| 1.6 | `industryMatch` | In a followed industry |
| 1.5 | `freshness` | Exponential decay, ~1 week half-life |
| 1.2 | `topicMatch` | Touches a followed topic |
| 1.2 | `evidenceStrength` | Inverse of the strength rank |
| 1.1 | `knowledgeGap` | Connects to an uncovered concept |
| 1.0 | `technologyMatch` | Involves a followed technology |
| 1.0 | `novelty` | New to world 1.0 → restated 0.0 |
| 0.9 | `maturitySubstance` | Measured outcome outranks announcement |
| 0.8 | `corroboration` | Independent sources reported it |
| −0.5 | `firstPartyOnlyPenalty` | Nobody independent has confirmed it |
| −1.4 | `repetitionPenalty` | Repeated story |
| −2.5 | `alreadyShownPenalty` | Already shown to this user |
| −0.3 | `demoPenalty` | Demo fixture data |

### What the weights encode

**Substance over noise.** `maturitySubstance` means a quantified outcome outranks an
announcement. A *reversal* scores 0.8 — high — because a discontinued programme is
unusually informative: the reasons given are worth more than the original announcement
was.

**Evidence is a ranking input.** Weak evidence should not float to the top on relevance
alone.

**Novelty is not freshness.** A restated announcement scores 0.0 on novelty however
recent it is, and the user is told it restates something.

**Repetition is penalised, not hidden.** Story fatigue is real; suppression is not the
answer.

**Freshness decays rather than cuts off.** A one-week half-life keeps things current
without discarding last month.

No `sourceQuality` term is applied at scoring time, deliberately: a high-quality
publication reporting a rumour is still a weak signal, and evidence strength already
carries that.

---

## Brief composition

The brief is **finite**, and finiteness is structural rather than a suggestion:

- composition stops at the reading budget
- each item is used once
- the brief is composed once per day and **stored**, so the set cannot grow while it is
  being read

That last point is what makes "You are caught up" mean something. A brief re-queried on
every page load would silently acquire new items, and the caught-up state would be a
lie.

### Section order

`executive_three` → `what_changed` → `company_watch` → `industry_signals` →
`tech_radar` → `broader_market` → `adjacent_signal` → `learn_one_thing`

Every brief must contain at least one recency, one depth and one applicability
element — the North Star requirement. Insights carry all three internally, and
`learn_one_thing` guarantees a depth element even on a thin news day.

### The reserved adjacent slot

Exactly one item matching **none** of the user's stated interests, as the filter-bubble
guard.

It is selected **first** and displayed last. Filling in display order starved it: the
earlier sections consumed the whole reading budget and the one reserved slot silently
disappeared — exactly the failure the reservation exists to prevent. Display order is
controlled by the UI's section ordering, so choosing it early costs nothing. Found by a
unit test, which now asserts the slot is present and genuinely outside the user's
interests.

### Exploration budget

```
coreInterests 60% · mission 15% · knowledgeGaps 15% · adjacent 10%
```

Configurable. Currently expressed through section limits rather than strict quotas.

---

## What a short day looks like

The brief never pads.

- **Nothing at all:** *"No new events were found in the currently monitored sources."*
  A statement about the sources, not about the world.
- **Thin:** *"Short brief today: 3 items met the relevance bar from the monitored
  sources. Nothing has been added to fill the time."*

Both are unit-tested, because padding is how "nothing important happened today" becomes
eight items of filler and the brief stops being trustworthy.

---

## Mission Mode

A temporary emphasis with an expiry that **blends** with the baseline rather than
replacing it. `missionMatch` (1.8) sits between industry (1.6) and watchlist (2.2): a
mission raises relevance without erasing long-term interests. Missions are pausable and
editable, and expire on their own.

---

## Deliberately absent

- **No engagement signals.** Nothing rewards longer sessions, and there is no dwell-time
  or click-through term. A ranking model tuned on attention produces the product this
  one exists to replace.
- **No popularity.** No source is ranked up for being widely cited.
- **No collaborative filtering.** "Users like you read this" is unexplainable, and
  explainability is a requirement.
- **No learned model.** Not because learning is wrong, but because at this stage an
  inspectable weights object a consultant can argue with is worth more than a marginally
  better ordering they cannot interrogate.
