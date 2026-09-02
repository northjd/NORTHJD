# Source Registry

The 18 registered sources with their rights decisions as at 2026-09-01. The live
registry in `/admin/sources` is authoritative; this is the reviewed snapshot.

---

## Active — verified fetching

| Slug | Source | Perspective | Retains | Notes |
|---|---|---|---|---|
| `nvidia-newsroom` | NVIDIA Newsroom | First-party vendor | excerpt | `releases.xml` |
| `microsoft-news` | Microsoft News | First-party vendor | excerpt | **Disabled at runtime** — HTTP 403 |
| `google-blog` | Google — The Keyword | First-party vendor | excerpt | |
| `openai-news` | OpenAI News | First-party vendor | excerpt | |
| `meta-newsroom` | Meta Newsroom | First-party vendor | excerpt | |
| `aws-ml-blog` | AWS Machine Learning Blog | First-party vendor | excerpt | Customer stories are vendor-authored |
| `hm-group-news` | H&M Group News | First-party company | excerpt | |
| `retail-dive` | Retail Dive | **Trade press** | excerpt | Attribution required |
| `european-commission-press` | EC Press Corner | **Regulator** | excerpt | Reusable with acknowledgement |
| `nist-news` | NIST News | **Public institution** | excerpt | US federal work |
| `mckinsey-insights` | McKinsey Insights | First-party consulting | excerpt | Never counts as independent |
| `manual-url-ingestion` | Manual URL | User-provided | excerpt | On demand only |

Review basis for all of the above: publisher-operated feed; `robots.txt` retrieved
2026-09-01 with no rule disallowing the feed path; only feed content stored; the article
link is never followed; attribution and original link on every derived item.

### Microsoft News — the instructive case

Returned HTTP 200 to a probe and HTTP 403 to the pipeline's declared user agent. Sending
a browser user agent would likely have worked; that was **not** done, because defeating
an access control by misrepresenting the client is evasion regardless of how easy it is.
Connector disabled, `HTTP 403` recorded as the reason, and the source appears as a gap
in the coverage dashboard.

---

## Candidates — registered, not running

`rights_status = pending_review`, connectors off. Probe results recorded verbatim.

| Slug | Source | Why not running |
|---|---|---|
| `accenture-newsroom` | Accenture Newsroom | No working feed. Probed `/rss/news-releases.xml`, `/rss/`, `/news/rss`, `/subjects/all/rss.xml`, `/feed/` — all HTTP 404 |
| `anthropic-news` | Anthropic News | No working feed. Probed `/rss.xml`, `/news/rss.xml`, `/news/feed.xml` — all HTTP 404 |
| `inditex-press` | Inditex Press | RSS API path returns 404; `/itxcomweb/en/rss` returns HTML |
| `zalando-corporate` | Zalando Newsroom | `/en/rss.xml` and `/en/newsroom/rss.xml` both 404 |
| `sec-edgar` | SEC EDGAR | **Not blocked by rights.** EDGAR permits automated access under a declared user agent and rate limit. The `filing_api` connector is not implemented |

Enabling any of the first four requires a confirmed publisher feed URL and a terms
review — not a scraper. EDGAR requires a connector.

---

## Demo — labelled fixtures

| Slug | Source | Perspective | Purpose |
|---|---|---|---|
| `demo-fixtures` | Demo Corporate Newsroom | First-party company | Company announcements |
| `demo-trade-press` | Demo Trade Press | **Trade press** | Independent coverage |

Two sources rather than one, deliberately: with a single demo source, cross-source
corroboration and the first-party/independent distinction cannot be demonstrated at all.

Six fixtures exercise: a self-reported quantified claim that must **not** be promoted to
independently validated; one event reported by two sources; two sources giving different
figures for the same result; marketing language around what is only a pilot; and a
discontinued programme.

Everything derived from them carries a **Demo data** badge.

---

## Perspective distribution

| Perspective | Sources | Documents |
|---|---|---|
| First-party vendor | 6 | ~95 |
| First-party consulting | 1 | ~25 |
| Regulator | 1 | ~21 |
| Public institution | 1 | ~25 |
| First-party company | 1 | ~10 |
| Trade press | 1 | ~10 |
| Demo | 2 | 6 |

**Roughly 70% of documents are first-party.** That is a real limitation, it is visible in
the coverage dashboard, and it is why every first-party claim is labelled as
self-reported rather than quietly averaged in with independent reporting.
