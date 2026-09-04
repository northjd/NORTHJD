# Deploying NORTH

One platform, one bill, about twenty minutes. Everything below is done in the Vercel
dashboard — there is no second service to manage.

**What you end up with:** a real URL, your own accounts, ingestion every three hours so
the data is never stale, and feedback from colleagues landing in the database.

**What it costs: $20/month (~£16), all of it Vercel.**

|                           | Plan                 | Cost      |
| ------------------------- | -------------------- | --------- |
| App + scheduled ingestion | Vercel Pro, one seat | $20/month |
| Database                  | Neon Free            | £0        |

The seat is for _dashboard access_, which only you need. Colleagues sign in to NORTH
itself with their own accounts and cost nothing, however many of them there are.

The database is Neon, created directly at [neon.com](https://neon.com) rather than through
Vercel's marketplace. Vercel has no first-party Postgres, so either route runs on Neon —
going direct costs one extra signup and gives you Neon's own console, which has the SQL
editor, branching and the usage graphs. Since the free tier is £0 there is no second
invoice to consolidate, which was the only argument for the marketplace route.

> **Why Pro and not the free Hobby plan.** Two reasons, both real. Hobby limits scheduled
> jobs to **once per day**, which would make a product called "Today" a day behind. And
> Hobby's terms forbid commercial use — showing an internal tool to colleagues is a
> defensible personal project, an officially adopted one is not. If neither matters to
> you, everything here works on Hobby with the schedule changed to daily.

---

## 1. Put the code somewhere Vercel can see it

Vercel deploys from a git repository. The repository is already initialised locally with
its full history, so this is one push.

Create an empty **private** repository on GitHub, then:

```bash
cd ~/dev/ap-workspace/market-intelligence-os
git remote add origin https://github.com/<you>/north.git
git push -u origin main
```

Nothing secret is committed — `.env` is ignored and always has been. Worth confirming
once:

```bash
git ls-files | grep -c "^\.env$"
```

That must print `0`.

---

## 2. Create the project

1. Vercel → **Add New → Project** → import the repository.
2. Framework preset: **Next.js** (detected automatically).
3. Root directory: leave as the repository root — the monorepo is configured for it.
4. **Do not deploy yet.** Add the database and the variables first, or the first build
   will fail on a missing `DATABASE_URL` and you will have to redeploy anyway.

---

## 3. Create the database

At [neon.com](https://neon.com): sign up, **Create project**, Postgres 17 or later, region
closest to your Vercel region (`eu-central-1` if you are on Frankfurt).

Copy the connection string from **Dashboard → Connect**.

**Take the pooled one.** Neon offers a direct and a pooled URL. Serverless functions open
many short-lived connections and the pooler is what stops that exhausting the database.
The pooled URL has **`-pooler`** in the hostname:

```
postgres://user:pass@ep-something-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
                                    ^^^^^^^
```

Getting this wrong does not fail immediately — it fails later, under concurrent use,
which is the worst way for it to fail.

---

## 4. Set the environment variables

Project → **Settings → Environment Variables**. Add these to _Production_ (and _Preview_
if you want deploy previews to work):

| Variable             | Value                           | Why                                                                                                           |
| -------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`           | `production`                    | Enables secure cookies                                                                                        |
| `DATABASE_URL`       | the pooled Neon URL from step 3 |                                                                                                               |
| `DATABASE_POOL_MAX`  | `5`                             | Real Postgres, so use a pool. Small per instance, because many instances exist                                |
| `SIGNUP_INVITE_CODE` | something you invent            | Colleagues need it to create an account. Rotate it any time                                                   |
| `CRON_SECRET`        | a long random string            | Vercel sends this to the ingestion route. **Without it the route refuses every request**, which is deliberate |
| `SESSION_SECRET`     | a long random string            | Signs session cookies                                                                                         |

Generate the two secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Leave `ANTHROPIC_API_KEY` unset — NORTH runs
extractive, calls no language model, and costs nothing per request. That is a deliberate
design choice, not a limitation: nothing can be paraphrased into a claim the source did
not make.

---

## 5. Deploy, then set up the database

Hit **Deploy**. When it finishes, the schema does not exist yet — create it from your
machine, pointing at the production database:

```bash
cd ~/dev/ap-workspace/market-intelligence-os
export DATABASE_URL="<the pooled Neon URL>"
export DATABASE_POOL_MAX=5

npm run db:migrate     # tables, indexes, full-text search objects
npm run db:seed        # taxonomy, sources, learning units, demo fixtures
npm run pipeline       # first real ingestion — takes about 10 seconds
```

Then unset it so you do not keep working against production by accident:

```bash
unset DATABASE_URL DATABASE_POOL_MAX
```

---

## 6. Check it

- `https://<your-app>.vercel.app/api/health` → `{"status":"healthy", ...}`
- `https://<your-app>.vercel.app` → the NORTH landing page
- **Activate NORTH** → sign in

Create your own account at `/signup` with the invite code rather than using the seeded
demo login. The demo account has a password that is in the repository, and it should not
be the way in on a public URL.

Once you have your own account, remove the demo one:

```sql
delete from users where email = 'demo@market-intelligence-os.local';
```

---

## 7. Confirm ingestion is running

`vercel.json` schedules `/api/cron/ingest` at **17 minutes past, every three hours** — off
the hour deliberately, because scheduled jobs everywhere cluster on :00 and the sources
are politer to a request that does not arrive with everyone else's.

Check it in Vercel → **Cron Jobs** after the first run. To trigger one by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-app>.vercel.app/api/cron/ingest
```

It returns what it did — documents fetched, claims created, events created, errors. A run
takes 6–8 seconds against the current source set, measured rather than assumed.

---

## Inviting colleagues

Send them the URL and the invite code. They create their own account, go through set-up,
and get their own brief, reading history and saved insights. The corpus is shared, so
everyone is looking at the same evidence — which is the point, because then people can
disagree about the same thing.

Feedback goes to the widget in the bottom-left of every page and lands in the
`product_feedback` table, with the route they were on recorded automatically.

---

## What to watch

**Database compute.** Neon's free tier includes **100 compute-hours a month**, and that,
rather than storage, is the limit worth watching. The database sleeps when idle and stays
warm about five minutes after each query, so every scheduled run costs roughly five
minutes of compute.

At three-hourly that is **~20 compute-hours a month**, leaving about 80 for actual
reading. Comfortable rather than tight — which is exactly why the schedule is three-hourly
rather than hourly, since hourly would spend ~60 before anyone opened the app.

Neon's console shows consumption under **Monitoring**. If you ever want it fresher and
have the headroom, change one line and redeploy — no rebuild, no migration:

```jsonc
// vercel.json
"schedule": "17 * * * *"     // hourly
```

Exceeding the free tier suspends compute until the next month rather than producing a
surprise bill. Moving up is pay-as-you-go at about $0.11 per compute-hour.

**Storage** is not the constraint: the corpus is ~64 MB against a 0.5 GB allowance and
grows a megabyte or two a month.

**Function duration.** The pipeline is 6–8 seconds against ~14 sources. Adding many more
sources would grow it; the route allows 120 seconds and Pro permits up to 300.

**The demo data.** Four demo companies and their documents are clearly badged in the
interface, but they are fixtures rather than real reporting. `npm run db:seed` inserts
them; skip that step if you would rather colleagues never see them.

---

## Rolling back

Vercel keeps every deployment. **Deployments → ⋯ → Promote to Production** on the last
good one. Database migrations are additive, so a rollback of the application does not
need a rollback of the schema.
