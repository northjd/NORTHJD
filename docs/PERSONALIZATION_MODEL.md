# Personalization Model

Two layers that blend rather than override: a long-lived baseline profile, and a
time-boxed mission.

---

## Baseline profile

Durable interests and goals: role and seniority, industries, functions, technologies,
topics, geographies, information goals, learning objectives, daily reading budget,
preferred depth, response language, and whether to keep original terminology.

`daily_reading_minutes` (default 12) is not cosmetic — it is the constraint that makes
the brief finite. Composition stops there.

---

## Mission Mode

A temporary emphasis with an expiry.

> "For the next three weeks, prioritise Fashion, Retail Planning, Agentic AI, H&M,
> Inditex and Zalando."

It **blends** with the baseline rather than replacing it. `missionMatch` weighs 1.8,
between industry (1.6) and watchlist (2.2): a mission raises relevance without erasing
long-term interests. Missions are pausable, editable, and expire on their own — an
`ends_at` in the past simply stops applying.

This matters because the alternative is worse. A mode that replaced the profile would
mean a three-week engagement erases three months of accumulated interest signal, and the
user would have to rebuild it afterwards.

---

## Watchlists

Companies, industries, topics, technologies, with a `relationship` of account, prospect,
competitor or interest. Accounts and prospects weigh more (2.6) than general interest
(2.2), and the relationship is what appears in the ranking explanation — _"It involves
one of your accounts."_

Shared watchlists have a nullable `user_id` and an `is_shared` flag, so the team story
needs no migration.

---

## Knowledge gaps as a positive signal

Concepts at `unseen`, `introduced` or `needs_refresh` count as gaps, and an event
touching one gains 1.1. This is the mechanism by which the brief teaches rather than only
informs — and the reason shown is _"It connects to a concept you have not covered
yet."_

---

## Exploration budget

```
coreInterests 60% · mission 15% · knowledgeGaps 15% · adjacent 10%
```

The adjacent 10% is one reserved slot matching **none** of the user's stated interests.
It is selected before the discretionary sections precisely because relevance scoring
will never surface it on its own — and because filling in display order starved it in
practice.

Without it, a relevance-ranked brief converges on what the user already knows they care
about, which is the failure mode of every personalised feed.

---

## Language

The schema separates content language from response language, and
`keep_original_terms` allows German answers that retain English domain terminology —
"full-price sell-through" should not become "Verkaufsdurchsatz zum Vollpreis".

**Currently interface-only.** The UI is English; `packages/ui/i18n` is the intended
seam. Coverage is English in practice, so translated summaries would have nothing to
translate from.

---

## What is not used

- **No engagement signals.** No dwell time, no click-through, no scroll depth. A model
  tuned on attention produces the product this one replaces.
- **No collaborative filtering.** "Users like you" is unexplainable.
- **No inferred interests.** Only stated preferences, explicit watchlists and explicit
  reflection. Inferring that someone cares about a topic from three clicks produces a
  profile they never chose and cannot see.
- **No shadow profile.** Everything influencing selection is visible in Profile.

---

## Cold start

A new user with no profile still gets a working brief: `strategicImpact`,
`evidenceStrength`, `freshness` and `novelty` apply to everyone. The reason shown is
honest — _"It scored highly on strategic impact and recency, outside your stated
interests."_

Onboarding then collects the baseline. The seeded demo profile shows what a configured
one looks like.
