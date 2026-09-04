# Deploying NORTH

One URL, no server, no bill. GitHub builds the site every three hours on its own
machines and publishes it — your laptop can be shut.

**What you end up with:** a real URL you can send to a colleague, a site that refreshes
itself eight times a day, and a build that refuses to publish if the evidence rules
break.

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

Each run:

1. starts PGlite — real PostgreSQL compiled to WASM, so there is no database service to
   provision or pay for;
2. creates the schema and loads the reference data;
3. fetches every registered source with an approved rights review;
4. **runs `npm run eval`** and fails the build if any evidence invariant breaks;
5. builds the static site and publishes it.

Step 4 is the important one. A site that is stale is a nuisance; a site showing a claim
with no evidence behind it is a lie, and this refuses to publish one.

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

| Thing                    | Limit                   | Where we are    |
| ------------------------ | ----------------------- | --------------- |
| Actions minutes (public) | unlimited               | ~10 min × 8/day |
| Published site size      | 1 GB soft limit         | ~200 MB         |
| Pages bandwidth          | 100 GB/month soft limit | far below       |
| Builds per hour          | 10                      | 1 every 3 hours |

The site is uploaded as a build artifact rather than committed. The output is ~200 MB and
changes substantially every three hours; committing it would make the repository unusable
inside a week.

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

**The site is stale.** Check Actions. GitHub disables scheduled workflows on repositories
with no activity for 60 days; a single push or a manual run re-enables them.

---

## Running it as a real server instead

Everything the export leaves out — accounts, feedback, the coverage check, meeting
preparation — needs a server and a managed PostgreSQL. `vercel.json` and the
`AUTH_MODE`, `SESSION_SECRET` and `DATABASE_URL` settings in `.env.example` are still
there for that, and `npm run build` with `BUILD_STANDALONE=1` produces a deployable
server build. That is a different decision with a monthly bill attached, and it is not
needed to share the reading product with colleagues.
