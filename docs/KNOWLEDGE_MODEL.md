# Personal Knowledge Model

A cautious estimate of what a user has met, never an assertion about what they know.

---

## States

| State | Meaning | Order |
|---|---|---|
| `unseen` | No recorded interaction | 0 |
| `introduced` | Encountered it | 1 |
| `explored` | Engaged with material about it | 2 |
| `understood` | Evidence of comprehension | 3 |
| `applied` | Used it in real work | 4 |
| `needs_refresh` | Previously held; due for revisiting | 2 |

`applied` is the highest because using something is the strongest available evidence of
holding it. `needs_refresh` sits at explored rather than at zero — decay is not
amnesia.

---

## Every value carries its reason

```ts
user_knowledge_states {
  state, confidence, userAsserted,
  lastEvidenceKind, reason,        // shown verbatim to the user
  lastInteractionAt, reviewDueAt, reviewCount
}
```

`reason` is human-readable and rendered directly:

> *"You passed the knowledge check for How fashion retailers make money."*
> *"You marked an insight touching this concept as something you already knew."*
> *"You read an insight touching this concept. Reading is not the same as
> understanding, so this only marks it as introduced."*

That third one is the model's character in one sentence.

---

## Evidence kinds and how far each moves the state

| Signal | Result | Confidence |
|---|---|---|
| `self_assessed` | `understood` | 0.90 |
| `knowledge_check_passed` | `understood` | 0.75 |
| `used_in_meeting_brief` | `applied` | 0.70 |
| `learning_unit_completed` | `explored` → `understood` | 0.60 |
| `knowledge_check_failed` | `needs_refresh` | 0.40 |
| `content_saved` | `introduced` | 0.35 |
| `insight_read` | `introduced` only | 0.30 |
| `repeatedly_skipped` | unchanged | 0.20 |
| `decay` | `needs_refresh` | 0.30 |

**Inferred signals never jump more than one level.** Reading one article about a KPI is
not understanding it, and a model that pretended otherwise would produce a knowledge
state the user could not recognise as their own — at which point they would stop
trusting it, and it would be worse than nothing.

Only explicit user assertions and passed knowledge checks move state decisively.

---

## The user always wins

`userAsserted` beats anything inferred. `setKnowledgeStateAction` records confidence 0.95
and the reason *"You set this yourself."*

Visible and editable in Profile and Learn, with the reason and whether it was
self-assessed shown on every row. A user must be able to see what the system believes
about them and correct it — otherwise it is a hidden profile.

---

## New to the world vs. new to the user

Different axes, both real:

- **New to the world** — `novelty: new_to_world`, from the event's dates
- **New to the user** — `novelty: new_to_user`, when the concept state is `unseen` or
  `introduced`

A 2023 concept the user has never met is legitimately new *to them*. A re-announced
partnership is new to nobody and is labelled `Restated`, scoring 0.0 on novelty however
recent it is.

The brief blends both: recency sections use world-novelty, `learn_one_thing` uses
user-novelty.

---

## What this model refuses to do

- **No inference from time-on-page.** Dwell time measures scrolling.
- **No inference from search queries.** Searching for something is at least as likely to
  mean not knowing it.
- **No comparison between users.** No "you are behind your peers".
- **No hidden profile.** Every value is visible with its reason.
- **No confident claims from thin evidence.** `insight_read` yields 0.30, and the reason
  says why.

---

## Limitations

- Concept granularity is fixed by the seeded taxonomy — 91 concepts. Something outside it
  cannot be tracked.
- No decay scheduler runs, so `needs_refresh` only arrives via a failed check.
- No cross-concept inference: understanding markdown does not raise gross margin, even
  though the KPI tree records the relationship.
- Confidence values are hand-set rather than calibrated against outcomes.
