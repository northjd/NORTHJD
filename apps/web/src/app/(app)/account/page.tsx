import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { db, schema } from '@mios/database';
import { requireUser } from '@/lib/session';
import { queryAccount, type AccountEvent, type AccountRung } from '@/lib/account-queries';
import { searchEntities } from '@/lib/entity-search';
import { Badge, Card, InterpretationBlock, MaturityBadge } from '@mios/ui';
import { formatAbsolute } from '@mios/domain';
import type { CaseMaturity, EvidenceStrength } from '@mios/domain';
import { EvidenceBadge } from '@mios/ui';

export const dynamic = 'force-dynamic';

/**
 * My client — everything relevant to one account.
 *
 * If there is nothing on the client, this shows who they are compared against; failing
 * that, their industry; failing that, the cross-industry forces; failing that, the
 * market. There is always something worth walking into a meeting with, and the page
 * always states which level it is speaking at, so market context is never mistaken for
 * news about your client.
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; industry?: string }>;
}) {
  const user = await requireUser();
  const { slug: requested, industry } = await searchParams;

  // Account resolution: an explicit choice, then a configured mission, then the
  // watchlist. Nothing about any particular company is hard-coded.
  const mission = await db().query.userMissions.findFirst({
    where: eq(schema.userMissions.userId, user.userId),
  });

  const watchlistEntity = await db()
    .select({ slug: schema.entities.slug })
    .from(schema.watchlistItems)
    .innerJoin(schema.watchlists, eq(schema.watchlists.id, schema.watchlistItems.watchlistId))
    .innerJoin(schema.entities, eq(schema.entities.id, schema.watchlistItems.entityId))
    .where(eq(schema.watchlists.workspaceId, user.workspaceId))
    .limit(1);

  const slug = requested ?? watchlistEntity[0]?.slug ?? null;
  const choices = (await searchEntities('', 14)).filter((e) => e.events > 0).slice(0, 10);

  if (!slug) {
    return (
      <div className="mx-auto max-w-[820px]">
        <p className="t-eyebrow">My client</p>
        <h1 className="mt-2 text-[27px] font-semibold leading-[1.16] tracking-[-0.028em]">
          Pick an account
        </h1>
        <p className="mt-3 max-w-[62ch] text-[14px] leading-[1.68] text-[var(--text-muted)]">
          Everything relevant to one client: what changed for them, what changed for the
          companies they are compared against, and what moved in their market.
        </p>
        <AccountChooser choices={choices} active={null} />
      </div>
    );
  }

  const board = await queryAccount(user.workspaceId, slug, industry ?? null);
  if (!board) {
    return (
      <div className="mx-auto max-w-[820px]">
        <h1 className="text-[22px] font-semibold">No such company</h1>
        <p className="mt-2 text-[13px] text-[var(--text-muted)]">
          <Link href={`/coverage?q=${encodeURIComponent(slug)}`} className="underline">
            Check whether anything mentions “{slug}”
          </Link>
        </p>
      </div>
    );
  }

  const leadRung = board.rungs.find((r) => r.level === board.leadWith)!;

  return (
    <div className="mx-auto max-w-[900px]">
      <p className="t-eyebrow">My client</p>
      <h1 className="mt-2 text-[27px] font-semibold leading-[1.16] tracking-[-0.028em]">
        {board.entity.name}
      </h1>
      <p className="mt-3 max-w-[62ch] text-[14px] leading-[1.68] text-[var(--text-muted)]">
        {board.entity.description ?? 'No description stored for this entity.'}
      </p>

      {board.skipped.length > 0 ? (
        <div className="mt-6 border-l border-caution-500/50 pl-4">
          <p className="text-[8.5px] font-bold uppercase tracking-[0.17em] text-caution-700 dark:text-caution-100">
            Nothing at the level you asked for
          </p>
          <p className="mt-2 max-w-[70ch] text-[13px] leading-[1.65] text-[var(--text-muted)]">
            {board.skipped.map((r) => r.emptyMeans).join(' ')} So this leads with{' '}
            <strong className="font-semibold text-[var(--text)]">
              {leadRung.title.toLowerCase()}
            </strong>{' '}
            instead. Every level below is still shown, and each says what it is.
          </p>
        </div>
      ) : null}

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-[var(--border)] py-5 sm:grid-cols-5">
        {board.rungs.map((r) => (
          <div key={r.level}>
            <dd
              className={`text-[22px] font-semibold leading-none tabular-nums tracking-tight ${
                r.level === board.leadWith ? '' : 'text-[var(--text-subtle)]'
              }`}
            >
              {r.events.length}
            </dd>
            <dt className="t-section mt-1.5">{r.title.replace(/^On /, '')}</dt>
          </div>
        ))}
      </dl>

      <AccountChooser choices={choices} active={board.entity.slug} />

      <section className="mt-8">
        <h2 className="t-rule">Industry</h2>
        <p className="mt-2 max-w-[70ch] text-[13px] leading-[1.65] text-[var(--text-muted)]">
          {board.industryIsInferred
            ? `No industry is recorded for ${board.entity.name}, so this uses the industries on your own profile. Pick a different one and every level below re-scopes.`
            : `Recorded as ${board.industryNames}. Override it if the engagement sits elsewhere.`}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {board.allIndustries.map((i) => {
            const active = board.industrySlugs.includes(i.slug);
            return (
              <Link
                key={i.slug}
                href={`/account?slug=${board.entity.slug}&industry=${i.slug}`}
                className={`rounded-md border px-2.5 py-1 text-[12px] ${
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--surface)]'
                    : 'border-[var(--border-strong)] hover:border-[var(--accent-line)]'
                }`}
              >
                {i.name}
              </Link>
            );
          })}
        </div>
      </section>

      {board.rungs.map((rung) => (
        <RungSection key={rung.level} rung={rung} />
      ))}

      <section className="mt-10">
        <h2 className="t-rule">Ask about this account</h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[
            `What changed for ${board.entity.name} recently?`,
            `What is moving in ${board.industryNames ?? 'this market'} that ${board.entity.name} has not addressed?`,
            `Challenge the claim that ${board.entity.name} is ahead on AI`,
            `Prepare me for a meeting with ${board.entity.name}`,
          ].map((q) => (
            <Link
              key={q}
              href={`/companion?q=${encodeURIComponent(q)}`}
              className="rounded-full border border-[var(--border-strong)] px-3 py-1 text-[12px] text-[var(--text-muted)] hover:border-[var(--accent-line)] hover:text-[var(--text)]"
            >
              {q}
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-8">
        <InterpretationBlock label="What this view cannot do">
          <p>
            It cannot tell you the client&rsquo;s internal position, their financials beyond
            what is published, or what they think. It reports what monitored public sources
            have said, widens its scope until it has something, and names the level it is
            speaking at so you never mistake market context for news about your client.
          </p>
        </InterpretationBlock>
      </div>
    </div>
  );
}

function AccountChooser({
  choices,
  active,
}: {
  choices: { slug: string; name: string; events: number }[];
  active: string | null;
}) {
  return (
    <section className="mt-8">
      <h2 className="t-rule">Account</h2>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {choices.map((c) => (
          <Link
            key={c.slug}
            href={`/account?slug=${c.slug}`}
            className={`rounded-md border px-2.5 py-1 text-[12px] ${
              c.slug === active
                ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--surface)]'
                : 'border-[var(--border-strong)] hover:border-[var(--accent-line)]'
            }`}
          >
            {c.name}
            <span className="ml-1.5 opacity-60 tabular-nums">{c.events}</span>
          </Link>
        ))}
        <Link
          href="/coverage"
          className="rounded-md border border-[var(--border-strong)] px-2.5 py-1 text-[12px] hover:border-[var(--accent-line)]"
        >
          Search all companies…
        </Link>
      </div>
    </section>
  );
}

function RungSection({ rung }: { rung: AccountRung }) {
  return (
    <section className="mt-9">
      <h2 className="t-rule">
        <span className="row-index mr-1">{rung.index}</span>
        {rung.title}
        <Badge tone="muted">{rung.events.length}</Badge>
      </h2>
      <p className="mt-2 max-w-[72ch] text-[13px] leading-[1.65] text-[var(--text-muted)]">
        {rung.why}
      </p>
      {rung.events.length === 0 ? (
        <p className="mt-3 max-w-[72ch] text-[13px] leading-[1.65] text-[var(--text-subtle)]">
          {rung.emptyMeans}
        </p>
      ) : (
        <ul className="mt-3 grid gap-2.5">
          {rung.events.map((e, i) => (
            <EventRow key={e.id} event={e} index={i + 1} />
          ))}
        </ul>
      )}
    </section>
  );
}

function EventRow({ event, index }: { event: AccountEvent; index: number }) {
  return (
    <Card as="li">
      <div className="flex gap-3">
        <span className="row-index pt-1">{String(index).padStart(2, '0')}</span>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <MaturityBadge maturity={event.caseMaturity as CaseMaturity} />
            <EvidenceBadge strength={event.evidenceStrength as EvidenceStrength} />
            {event.firstPartyOnly ? <Badge tone="caution">Self-reported</Badge> : null}
          </div>
          <h3 className="text-[13.5px] font-medium leading-snug">
            {event.insightId ? (
              <Link href={`/insights/${event.insightId}`} className="hover:underline">
                {event.title}
              </Link>
            ) : (
              event.title
            )}
          </h3>
          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--text-subtle)]">
            {event.entityNames ? (
              <span className="text-[var(--text-muted)]">
                {event.entityNames.split(', ').slice(0, 2).join(', ')}
              </span>
            ) : null}
            <span>{formatAbsolute(event.eventAt ?? event.firstReportedAt)}</span>
            <span>
              {event.sourceCount} source{event.sourceCount === 1 ? '' : 's'}
              {event.independentSourceCount > 0
                ? ` · ${event.independentSourceCount} independent`
                : ''}
            </span>
          </p>
        </div>
      </div>
    </Card>
  );
}
