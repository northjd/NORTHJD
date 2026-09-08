# Deploying NORTH

One URL, no server, no bill. GitHub builds the site every three hours on its own
machines and publishes it — your laptop can be shut.

**What you end up with:** a real URL you can send to a colleague, a site that refreshes
itself through the day, and a build that refuses to publish if the evidence rules break.

**What it costs: nothing.** GitHub Actions minutes are unlimited on public repositories,
and Pages is free.

**What you give up**, compared with running a server: there are no accounts, so nothing
is per-person except what each browser stores for itself; feedback is not collected
centrally; and anything that needs a request-time server — the free-text coverage check,
meeting preparation, saved conversations — is left out of the export. The build prints
the full exclusion list and writes it to `BUILD.txt` in the output.

---

## Before you start

You need a GitHub account. That is the whole list.

The repository has to be **public** for Pages to work on a free account. Everything in it
is public information: the source registry, the taxonomy, and a list of large public
companies used as search reference data. Nothing marks any company as a client, and no
client analysis is stored anywhere in the repository. If that is not acceptable for your
situation, GitHub Pro ($4/month) allows Pages from a private repository — in which case
change the cron in `.github/workflows/publish.yml` to `0 */6 * * *`, because Actions
minutes are metered on private repos.

---

## 1. Create the repository and push

```bash
gh repo create north --public --source=. --remote=origin --push
```

If you would rather do it in the browser: create an empty public repository called
`north`, then

```bash
git remote add origin https://github.com/<your-username>/north.git && git push -u origin main
```

## 2. Turn on Pages

In the repository, **Settings → Pages → Build and deployment → Source**, choose
**GitHub Actions**. There is nothing else to configure — the workflow already declares
the permissions it needs.

## 3. Run it once

**Actions → Publish NORTH → Run workflow.** The first run takes about ten minutes: it
installs dependencies, starts PGlite, creates the schema, fetches every source, checks
the evidence invariants and builds 900-odd pages.

When it finishes, the URL is at the bottom of the `deploy` job, and under
**Settings → Pages**. It looks like `https://<your-username>.github.io/north/`.

That is the link you send people.

---

## What runs, and when

`.github/workflows/publish.yml` runs on a push to `main`, on demand, and on a cron at
`17 */3 * * *` — seventeen minutes past, every three hours. The odd minute is
deliberate: scheduled jobs everywhere cluster on the hour, and the sources are politer to
a request that does not arrive with everyone else's.

**In practice it fires four to six times a day, not eight.** Measured across 7–8
September: scheduled runs at 12:32, 19:09, 23:29, 04:36 and 11:18 — intervals of four to
seven hours against a three-hour cron. GitHub runs scheduled workflows on a best-effort
queue and drops or delays them under load; this is documented behaviour on free runners
and no configuration changes it. A push always runs immediately, so this only affects how
fresh the site is when nobody is committing.

Each run:

1. **restores the corpus** from the previous run's cache;
2. starts PGlite — real PostgreSQL compiled to WASM, so there is no database service to
   provision or pay for;
3. creates the schema and loads the reference data;
4. fetches every registered source with an approved rights review;
5. **runs `npm run eval`** and fails the build if any evidence invariant breaks;
6. prunes anything past the retention window and saves the corpus for the next run;
7. builds the static site and publishes it.

Step 5 is the important one. A site that is stale is a nuisance; a site showing a claim
with no evidence behind it is a lie, and this refuses to publish one.

## The corpus accumulates

Steps 1 and 6 are what make this a record rather than a reader. Without them the database
was created from empty every three hours, so the site only ever held what the feeds
happened to be carrying — usually their last twenty-five items. Healthcare & Payers once
went from two events to zero, not because the sector quietened but because Healthcare
Dive rotated those items out of its feed.

`data/pglite` is now cached between runs under a rolling key, and ingestion deduplicates
on a content fingerprint, so re-reading feed items already held costs a fetch and writes
nothing.

**Retention has two ceilings**, both set in the workflow. `CORPUS_RETENTION_DAYS` (400)
says how far back to reach; `CORPUS_MAX_DOCUMENTS` (2,500) says how much may be kept, and
it is the one that actually binds. A window alone would work until the day the feeds got
busy and then fail every build — which is worse than not accumulating at all, because a
failing build publishes nothing.

2,500 comes from measurement, not preference: a 964-document corpus produced a 206.5 MB
export, so a document costs about 0.214 MB of published site once its evidence, event and
insight pages are written. Against the 850 MB budget that is roughly 4,000; 2,500 leaves
room for the sections that do not scale with the corpus.

How many days that buys depends on how much the publishers publish, which is not ours to
decide — so the market index prints the date the corpus actually reaches rather than a
promised one. Documents past either ceiling are deleted, along with any event left with
no documents behind it: an event whose last document has gone is a headline with nothing
under it. Seeded demo material is never pruned.

**To start again from nothing:** Actions → Publish NORTH → Run workflow, and tick _Start
from an empty corpus_. Do that after a schema change that cannot be migrated forward, or
if a cache is ever suspected of being wrong. A cache that will not open is handled without
help: the run rebuilds from empty, publishes a warning saying so, and carries on rather
than freezing the site.

Caches expire after seven days unused and are capped at 10 GB per repository, evicted
least-recently-used. Only the newest is ever restored, so eviction takes the ones already
superseded.

## The sub-path

A project site is served from `https://<user>.github.io/<repo>/`, not from the root. The
workflow works out the right `BASE_PATH` from the repository name and passes it to the
build. If you rename the repository, the next run picks the new name up on its own.

To check the built site behaves under that prefix before publishing:

```bash
npm run build:static && npm run serve:static
```

That serves `apps/web/out` from `http://localhost:4500/north/` and returns 404 for
anything requested outside the prefix — which is how a `fetch('/evidence.json')` that
worked on every local check got caught before it reached production.

## Costs and limits

| Thing                    | Limit                   | Where we are     |
| ------------------------ | ----------------------- | ---------------- |
| Actions minutes (public) | unlimited               | ~10 min × 5/day  |
| Published site size      | 1 GB soft limit         | see below        |
| Actions cache            | 10 GB, 7-day expiry     | ~15 MB per run   |
| Pages bandwidth          | 100 GB/month soft limit | far below        |
| Builds per hour          | 10                      | ~1 every 5 hours |

The site is uploaded as a build artifact rather than committed. It changes substantially
on every run; committing it would make the repository unusable inside a week.

**Site size is the constraint that accumulation pushes on**, and it is not gentle: an
evidence page costs roughly 110 KB to carry a quote averaging under 300 bytes, because
Next writes each page's RSC payload twice alongside the markup. `npm run build:static`
prints the size by section at the end of every build and **fails** above
`PAGES_SIZE_BUDGET_MB` (850 by default), with a warning from 75% of it. Failing in the
build is deliberate: crossing the limit silently would fail minutes later at the deploy
step, with a message about artifact size and no hint of the cause. If it ever fires, the
lever is `CORPUS_RETENTION_DAYS`.

## When something breaks

**The workflow fails at "Check the evidence invariants."** Working as intended — a source
started returning something that breaks a rule. `npm run eval` locally prints which case
failed.

**A source shows an error but the build passes.** Also intended. A feed returning 403 is
recorded against that source and the run continues; one publisher blocking us is not a
reason to stop publishing. The Sources admin page lists every failure with its status
code.

**The site loads but has no styling and dead links.** The `BASE_PATH` is wrong. Confirm
the repository name matches the URL, and reproduce locally with `npm run serve:static`.

**A market's event count fell.** Expect this only at the retention boundary now — the
corpus carries forward, so counts otherwise rise. A fall elsewhere means either an
admin suppressed events or a run reset the corpus; the run log says which, because a
reset publishes a warning.

**The site is stale.** Check Actions. GitHub disables scheduled workflows on repositories
with no activity for 60 days; a single push or a manual run re-enables them.
`.github/workflows/keepalive.yml` exists to prevent that: it commits a date stamp on the
first of each month so the repository is never quiet long enough for the clock to expire.
If the site has frozen anyway, check that workflow ran.

---

## Running it as a real server instead

Everything the export leaves out — accounts, feedback, the coverage check, meeting
preparation — needs a server and a managed PostgreSQL. `vercel.json` and the
`AUTH_MODE`, `SESSION_SECRET` and `DATABASE_URL` settings in `.env.example` are still
there for that, and `npm run build` with `BUILD_STANDALONE=1` produces a deployable
server build. That is a different decision with a monthly bill attached, and it is not
needed to share the reading product with colleagues.
