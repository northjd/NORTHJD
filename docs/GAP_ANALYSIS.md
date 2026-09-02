# Gap Analysis Against the Original Brief

A systematic pass over every section of the master prompt. Honest about what is built,
what is partial, and what is absent.

**Legend:** ✅ built · ⚠️ partial · ❌ absent

---

## §10 Information architecture

| Item | State |
|---|---|
| Today, Companion, Learn, Prepare, Explore, Library | ✅ |
| Global search | ✅ |
| Profile and preferences | ✅ |
| Admin | ✅ |
| **Notifications** | ❌ Schema and preferences exist; nothing generates or displays them |
| No dominant Accenture/consulting area | ✅ Asserted by test |

---

## §11 Today

| Section | State |
|---|---|
| Executive Three | ✅ |
| What Changed Since Your Last Visit | ✅ |
| Your Industry Signals | ✅ |
| Company and Account Watch | ✅ |
| AI and Technology Radar | ✅ |
| Broader Business and Market Signals | ✅ |
| One Adjacent Signal | ✅ Reserved before discretionary sections |
| Learn One Thing | ✅ |
| **Deep Dive of the Day** | ❌ Section type defined; nothing populates it |
| **Prepare for What Is Next** | ❌ Section type defined; needs meetings or calendar |
| Progress and caught-up state | ✅ |
| At least one recency + depth + application element | ✅ |
| No reserved company/firm quota | ✅ Asserted by test |

---

## §12 Companion

| Item | State |
|---|---|
| All seven modes | ✅ Verified against real data |
| Global text field, ⌘K, command palette, contextual actions | ✅ |
| Structured response shared by text and voice | ✅ |
| Citations to evidence spans | ✅ |
| Response length (6) and depth (3) | ✅ |
| Page context, disclosed | ✅ |
| Trust rules, as-of date, honest refusal | ✅ |
| Conversation transcript | ✅ |
| Basic voice input | ✅ Browser Web Speech, runtime-detected |
| **§12.4 Voice commands** — tell me more, skip, repeat, slower, deeper, source, save | ❌ |
| **§12.5 Live transcript during a voice session** | ❌ Transcript exists after, not during |
| **§12.5 Session progress indicator** | ❌ |
| **§12.10 Companion actions** — save insight, create/add to collection, follow company or topic, update mission, create meeting brief, create saved search, continue learning path, generate weekly review | ❌ **None wired.** The Companion can answer but cannot act |
| §12.7 Conversation memory layers | ⚠️ Session and preferences yes; no user-visible memory management UI |

---

## §13 Learn

| Item | State |
|---|---|
| Industry learning paths | ⚠️ 2 paths, 5 units. The brief's 18-step structure is partially covered by the industry pages, not by paths |
| Three depth levels | ✅ |
| Learning units with all required fields | ✅ |
| Knowledge checks | ✅ |
| Evergreen versioning and last-reviewed date | ✅ |
| **§13.4 Weekly Learning Review** | ❌ All inputs exist; no surface |
| **§13.5 Monthly State of Play** | ❌ |

---

## §14 Prepare

| Item | State |
|---|---|
| Manual meeting input | ✅ |
| 60-second brief | ✅ |
| What changed, per window | ✅ |
| Company context, evidenced | ✅ |
| **§14.4 Executive context** | ❌ Field exists, always empty. Needs person-level public statements |
| What this could mean, labelled | ✅ |
| Five conversation starters | ✅ |
| Contrarian angle | ✅ |
| Known unknowns | ✅ |
| **§14.9 Relevant market examples** | ❌ Field exists, always empty. Needs the case library |
| Sources with full metadata | ✅ |
| **Calendar integration** | ❌ Acknowledged as out of MVP scope |

---

## §15 Explore — **the largest gap**

| Area | State |
|---|---|
| Industries | ✅ 4 full market models |
| Companies | ✅ Timelines, maturity mix, coverage |
| Consulting and professional services | ✅ As one category |
| **Technologies** | ❌ Seeded as taxonomy; no pages |
| **Topics** | ❌ Seeded; no pages |
| **Trends** | ❌ Schema exists; no curated trends, no pages |
| **Markets and regions** | ❌ Geographies seeded; no pages |
| **Regulations** | ❌ No regulation entity or pages |
| **Research and publications** | ❌ |
| **Market maps** | ❌ |
| **Partnership networks** | ❌ Edges modelled; no visualisation |
| **Company comparisons** | ❌ |
| **Case libraries** | ❌ Schema exists; nothing populates it |
| Strategic move timelines | ✅ As company timelines |

### §15 Filters — **none built**

The brief lists eighteen. Not one is implemented as UI:

industry · sub-industry · company · company type · topic · capability · technology ·
geography · event type · publication date · event date · source perspective · evidence
strength · implementation maturity · source type · strategic impact · novelty ·
reading time

Every one of these is a stored, indexed column. The data supports all eighteen; the
interface exposes none. This is the single biggest usability gap in the build.

---

## §16 Library

| Item | State |
|---|---|
| Saved insights | ✅ |
| **Collections** | ⚠️ Schema and server action exist; no UI to create or manage |
| Notes | ✅ |
| Meeting briefs | ✅ |
| Conversation history | ✅ |
| **Learning progress** | ❌ Not surfaced in Library |
| **Saved searches** | ❌ Schema only |
| **Followed companies** | ❌ Schema only; watchlists cover part of this |
| **Followed topics** | ❌ Schema only |
| **Custom tags** | ⚠️ Field exists; no UI |

---

## §17–20 Sources, perspective, first-party rules

| Item | State |
|---|---|
| Tier 1 primary and official | ✅ 8 active |
| Tier 2 independent | ⚠️ **1 source only** — the standing product risk |
| Tier 3 licensed premium | ❌ Interfaces only, correctly |
| Tier 4 authorised internal | ❌ Schema only, correctly |
| Source policy with all required fields | ✅ |
| Connector types: RSS, Atom, manual URL, demo | ✅ |
| **REST/GraphQL/filing/licensed/sitemap/structured/upload/webhook/MCP** | ❌ Listed as not implemented in admin |
| Perspective classification and visible filter groups | ⚠️ Classification ✅; **the visible perspective filter is not built** |
| First-party content rules (self-reported, announcement ≠ implementation) | ✅ |

---

## §21–26 Intelligence, trust, maturity, consulting layer, graph, insight design

| Item | State |
|---|---|
| Full hierarchy source → … → briefing | ✅ |
| Claim types, verification status, evidence strength | ✅ |
| Contradiction surfacing | ✅ |
| Case maturity ladder | ✅ |
| **Case cards with scope/geography/functions/outcomes** | ❌ `case_studies` schema exists; nothing populates it |
| Consulting dimensions (levers, operating model, executive owner) | ✅ |
| Knowledge graph entities and relationships | ⚠️ Entities ✅; **most relationship types unpopulated** |
| Insight design — all required sections | ✅ |
| **Timeline on the insight** | ⚠️ Related events computed for "what changed"; no visual timeline |

---

## §27 Personalisation and onboarding

| Item | State |
|---|---|
| **Onboarding flow** | ❌ **Completely absent.** The profile is seeded; there is no UI to set it up |
| Baseline profile | ⚠️ Stored and displayed; **not editable in the UI** |
| **Mission Mode** | ⚠️ Schema, ranking integration and display ✅; **no UI to create, edit, pause or end one** |
| Reading budget, depth, language preferences | ⚠️ Stored; not editable |

---

## §28–29 Ranking and search

| Item | State |
|---|---|
| Transparent, configurable ranking | ✅ |
| Why am I seeing this | ✅ |
| Exploration budget | ✅ |
| No entity ranking advantage | ✅ Tested |
| Full-text search | ✅ |
| **Structured filters on search** | ❌ Same gap as Explore |
| Entity, event, date-range search | ⚠️ Entity and event ✅; **no date-range UI** |
| Semantic/hybrid retrieval | ❌ Interface only |
| Research answer structure (8 parts) | ✅ |

---

## §30 Alerts and notifications

**❌ Nothing built beyond schema.** Seven notification types are defined with per-user
preferences and thresholds. Nothing generates them and there is no inbox.

---

## §31–32 Multilingual and coverage

| Item | State |
|---|---|
| Multilingual schema, language fields, UTC normalisation | ✅ |
| Entity aliases and transliteration support | ✅ |
| **Language detection per document** | ❌ Source-declared only |
| **Translated summaries** | ❌ |
| **Non-English sources** | ❌ Coverage is English in practice |
| Coverage dashboard with gaps | ✅ |
| Separate timestamps | ✅ |
| "No new results" phrasing | ✅ |

---

## §33 Share and outputs

| Item | State |
|---|---|
| Copy executive summary, copy starters | ✅ |
| Print-friendly | ✅ CSS |
| **Share link** | ❌ |
| **Export as Markdown** | ❌ |
| PDF, PowerPoint, email digest, Teams, Slack, calendar | ❌ Correctly out of MVP scope |

---

## §34 Team and enterprise

Schema foundation ✅ (organization, workspace, membership, role, shared flags).
Everything above it ❌ — shared notes, comments, curated team briefings, editorial
review, SSO, SCIM, audit UI, permission-aware internal search. Correctly out of MVP
scope.

---

## §35 UX and design

| Item | State |
|---|---|
| Responsive, mobile reading, PWA manifest | ✅ |
| Light and dark mode | ✅ |
| Keyboard navigation, ⌘K | ✅ |
| Accessible components, focus states | ✅ |
| Meaningful loading, empty and error states | ✅ |
| No infinite scroll, no engagement manipulation | ✅ |
| Adjustable density | ❌ Single density |
| Offline access to the latest brief | ❌ Manifest exists; no service worker |
| **"Premium, alive" execution** | ⚠️ **Restrained to the point of flat.** Correct principles, under-delivered craft — see below |

---

## §43 Admin

| Item | State |
|---|---|
| Source registry, connector status, ingestion monitoring | ✅ |
| Coverage dashboard, evaluation dashboard | ✅ |
| Capability status | ✅ |
| **Source policy editing** | ❌ View only |
| **Failed job retry** | ❌ |
| **Document / claim inspection** | ❌ |
| **Event merge and split** | ❌ |
| **Entity correction** | ❌ |
| **Taxonomy management** | ❌ |
| **Featured insight management** | ❌ |
| **Content suppression** | ⚠️ Field and query filter exist; no UI |
| **Correction workflow** | ⚠️ Detection ✅; no review queue |
| **Audit trail UI** | ❌ Table only |
| **AI cost monitoring** | ❌ Table only |
| **Prompt version monitoring** | ❌ Table only |

---

## The honest summary

**Strong:** the intelligence layer, the evidence chain, the trust model, the source
rights model, ranking transparency, the Companion's answering behaviour, the industry
market models, testing and evaluation.

**The five gaps that matter most, in order:**

1. **Explore filters — eighteen dimensions, zero UI.** The data is indexed and ready.
   This is the biggest gap between what the system knows and what a user can reach.
2. **Onboarding and preference editing.** A new user cannot configure the product at
   all; the profile only exists because the seed created it. Mission Mode is unreachable.
3. **Companion actions.** It can answer but cannot save, follow, collect, or create a
   brief. §12.10 lists fifteen actions; none are wired.
4. **Explore breadth.** Only industries and companies have pages. Technologies, topics,
   trends, regulations, comparisons and case libraries are all absent.
5. **Design craft.** The principles are right and the execution is flat. Calm was
   allowed to become lifeless — insufficient type contrast, no depth, no motion, colour
   used only for badges, no data visualisation.

**Also absent:** notifications, weekly review, monthly state of play, collections UI,
saved searches, share/export, admin write operations, language detection, and a service
worker.
