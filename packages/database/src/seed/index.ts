/**
 * Seed runner.
 *
 * Idempotent: every insert is an upsert on a natural key, so `npm run db:seed` can be
 * re-run safely. It seeds reference content (taxonomy, learning material, entities,
 * the source registry) and one demo user; it does not fabricate events or insights —
 * those come from the pipeline, from real feeds and from the clearly-labelled demo
 * fixtures.
 */

import { eq, sql } from 'drizzle-orm';
import { aliasNeedsContext, normalizeAlias } from '@mios/intelligence';
import { db, schema } from '../client';
import { hashPassword } from '../auth';
import { INDUSTRIES, TOPICS, TECHNOLOGIES, GEOGRAPHIES } from './taxonomy';
import { ENTITIES } from './entities';
import { SOURCES } from './sources';
import { LEARNING_PATHS, EXTRA_CONCEPTS } from './learning';
import { DEMO_FIRST_PARTY_DOCUMENTS, DEMO_INDEPENDENT_DOCUMENTS } from './demo-documents';

const {
  businessModels,
  capabilities,
  entities,
  entityAliases,
  entityIndustries,
  geographies,
  industries,
  kpis,
  learningConcepts,
  learningPaths,
  learningUnits,
  memberships,
  notificationPreferences,
  organizations,
  sourceConnectors,
  sourcePolicies,
  sources,
  technologies,
  topics,
  userProfiles,
  users,
  valueChainStages,
  watchlistItems,
  watchlists,
  workspaces,
} = schema;

export interface SeedResult {
  organizationId: string;
  workspaceId: string;
  userId: string;
  demoEmail: string;
  demoPassword: string;
  counts: Record<string, number>;
}

const DEMO_EMAIL = 'demo@market-intelligence-os.local';
const DEMO_PASSWORD = 'demo-password-change-me';

export async function seed(log: (m: string) => void = console.log): Promise<SeedResult> {
  const d = db();
  const counts: Record<string, number> = {};

  // ── Taxonomy ──────────────────────────────────────────────────────────────

  for (const geo of GEOGRAPHIES) {
    await d
      .insert(geographies)
      .values({ slug: geo.slug, name: geo.name, isoCode: geo.isoCode })
      .onConflictDoUpdate({ target: geographies.slug, set: { name: geo.name } });
  }
  counts.geographies = GEOGRAPHIES.length;

  const industryIdBySlug = new Map<string, string>();
  // Two passes so a child industry can reference its parent.
  for (const ind of INDUSTRIES) {
    const [row] = await d
      .insert(industries)
      .values({
        slug: ind.slug,
        name: ind.name,
        definition: ind.definition,
        marketStructure: ind.marketStructure ?? '',
        regulatoryEnvironment: ind.regulatoryEnvironment ?? '',
        transformationAgenda: ind.transformationAgenda ?? '',
        openQuestions: ind.openQuestions ?? [],
        sourceRefs: ind.sourceRefs ?? [],
        lastReviewedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: industries.slug,
        set: {
          name: ind.name,
          definition: ind.definition,
          marketStructure: ind.marketStructure ?? '',
          regulatoryEnvironment: ind.regulatoryEnvironment ?? '',
          transformationAgenda: ind.transformationAgenda,
          openQuestions: ind.openQuestions ?? [],
          sourceRefs: ind.sourceRefs ?? [],
          lastReviewedAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();
    industryIdBySlug.set(ind.slug, row!.id);
  }
  for (const ind of INDUSTRIES) {
    if (!ind.parentSlug) continue;
    await d
      .update(industries)
      .set({ parentId: industryIdBySlug.get(ind.parentSlug) })
      .where(eq(industries.slug, ind.slug));
  }
  counts.industries = INDUSTRIES.length;

  const stageIdBySlug = new Map<string, string>();
  const kpiIdBySlug = new Map<string, string>();
  let stageCount = 0;
  let kpiCount = 0;
  let capCount = 0;
  let bmCount = 0;

  for (const ind of INDUSTRIES) {
    const industryId = industryIdBySlug.get(ind.slug)!;

    for (const [position, stage] of (ind.valueChainStages ?? []).entries()) {
      const [row] = await d
        .insert(valueChainStages)
        .values({
          industryId,
          slug: stage.slug,
          name: stage.name,
          position,
          description: stage.description,
          profitPoolNote: stage.profitPoolNote,
        })
        .onConflictDoUpdate({
          target: valueChainStages.slug,
          set: {
            name: stage.name,
            description: stage.description,
            profitPoolNote: stage.profitPoolNote,
            position,
          },
        })
        .returning();
      stageIdBySlug.set(stage.slug, row!.id);
      stageCount++;
    }

    for (const kpi of ind.kpis ?? []) {
      const [row] = await d
        .insert(kpis)
        .values({
          industryId,
          slug: kpi.slug,
          name: kpi.name,
          definition: kpi.definition,
          formula: kpi.formula,
          whyItMatters: kpi.whyItMatters,
          valueLever: kpi.valueLever as never,
          typicalRange: kpi.typicalRange ?? '',
        })
        .onConflictDoUpdate({
          target: kpis.slug,
          set: {
            name: kpi.name,
            definition: kpi.definition,
            formula: kpi.formula,
            whyItMatters: kpi.whyItMatters,
            typicalRange: kpi.typicalRange ?? '',
          },
        })
        .returning();
      kpiIdBySlug.set(kpi.slug, row!.id);
      kpiCount++;
    }
    for (const kpi of ind.kpis ?? []) {
      if (!kpi.parentSlug || kpi.parentSlug === kpi.slug) continue;
      const parentId = kpiIdBySlug.get(kpi.parentSlug);
      if (parentId) await d.update(kpis).set({ parentId }).where(eq(kpis.slug, kpi.slug));
    }

    for (const cap of ind.capabilities ?? []) {
      await d
        .insert(capabilities)
        .values({
          slug: cap.slug,
          name: cap.name,
          description: cap.description,
          valueChainStageId: cap.stageSlug ? stageIdBySlug.get(cap.stageSlug) : null,
          operatingModelDimensions: cap.dimensions,
        })
        .onConflictDoUpdate({
          target: capabilities.slug,
          set: {
            name: cap.name,
            description: cap.description,
            operatingModelDimensions: cap.dimensions,
          },
        });
      capCount++;
    }

    for (const bm of ind.businessModels ?? []) {
      await d
        .insert(businessModels)
        .values({
          industryId,
          slug: bm.slug,
          name: bm.name,
          description: bm.description,
          economics: bm.economics,
          exampleCompanyNames: bm.examples,
        })
        .onConflictDoUpdate({
          target: businessModels.slug,
          set: {
            name: bm.name,
            description: bm.description,
            economics: bm.economics,
            exampleCompanyNames: bm.examples,
          },
        });
      bmCount++;
    }
  }
  counts.valueChainStages = stageCount;
  counts.kpis = kpiCount;
  counts.capabilities = capCount;
  counts.businessModels = bmCount;

  for (const topic of TOPICS) {
    await d
      .insert(topics)
      .values(topic)
      .onConflictDoUpdate({
        target: topics.slug,
        set: { name: topic.name, description: topic.description },
      });
  }
  counts.topics = TOPICS.length;

  for (const tech of TECHNOLOGIES) {
    await d
      .insert(technologies)
      .values({
        slug: tech.slug,
        name: tech.name,
        description: tech.description,
        layer: tech.layer,
        enablesCapabilitySlugs: tech.enables,
      })
      .onConflictDoUpdate({
        target: technologies.slug,
        set: {
          name: tech.name,
          description: tech.description,
          layer: tech.layer,
          enablesCapabilitySlugs: tech.enables,
        },
      });
  }
  counts.technologies = TECHNOLOGIES.length;

  // ── Learning concepts ─────────────────────────────────────────────────────
  // One concept per KPI, capability, technology and value chain stage, so knowledge
  // state can attach to anything an event touches.

  const conceptSeeds = [
    ...EXTRA_CONCEPTS.map((c) => ({
      slug: c.slug,
      name: c.name,
      kind: c.kind,
      summary: c.summary,
      industrySlug: c.industrySlug,
      refSlug: null as string | null,
    })),
    // Industries and topics need concepts too, otherwise an event classified only by
    // industry or topic produces no learning connection and the Depth link is lost.
    ...INDUSTRIES.map((i) => ({
      slug: `concept-${i.slug}`,
      name: i.name,
      kind: 'industry_concept',
      summary: i.definition,
      industrySlug: i.slug,
      refSlug: i.slug,
    })),
    ...TOPICS.map((t) => ({
      slug: `concept-${t.slug}`,
      name: t.name,
      kind: 'industry_concept',
      summary: t.description,
      industrySlug: 'technology-ai',
      refSlug: t.slug,
    })),
    ...INDUSTRIES.flatMap((ind) => [
      ...(ind.kpis ?? []).map((k) => ({
        slug: `concept-${k.slug}`,
        name: k.name,
        kind: 'kpi',
        summary: k.whyItMatters,
        industrySlug: ind.slug,
        refSlug: k.slug,
      })),
      ...(ind.capabilities ?? []).map((c) => ({
        slug: `concept-${c.slug}`,
        name: c.name,
        kind: 'capability',
        summary: c.description,
        industrySlug: ind.slug,
        refSlug: c.slug,
      })),
      ...(ind.valueChainStages ?? []).map((s) => ({
        slug: `concept-${s.slug}`,
        name: s.name,
        kind: 'value_chain_stage',
        summary: s.description,
        industrySlug: ind.slug,
        refSlug: s.slug,
      })),
    ]),
    ...TECHNOLOGIES.map((t) => ({
      slug: `concept-${t.slug}`,
      name: t.name,
      kind: 'technology',
      summary: t.description,
      industrySlug: 'technology-ai',
      refSlug: t.slug,
    })),
  ];

  const conceptIdBySlug = new Map<string, string>();
  for (const c of conceptSeeds) {
    const [row] = await d
      .insert(learningConcepts)
      .values({
        slug: c.slug,
        name: c.name,
        kind: c.kind,
        summary: c.summary,
        industryId: industryIdBySlug.get(c.industrySlug) ?? null,
        refSlug: c.refSlug,
      })
      .onConflictDoUpdate({
        target: learningConcepts.slug,
        set: { name: c.name, summary: c.summary, refSlug: c.refSlug },
      })
      .returning();
    conceptIdBySlug.set(c.slug, row!.id);
  }
  counts.learningConcepts = conceptSeeds.length;

  // ── Learning paths and units ──────────────────────────────────────────────

  let unitCount = 0;
  for (const path of LEARNING_PATHS) {
    const [pathRow] = await d
      .insert(learningPaths)
      .values({
        slug: path.slug,
        name: path.name,
        description: path.description,
        industryId: industryIdBySlug.get(path.industrySlug) ?? null,
        position: path.position,
      })
      .onConflictDoUpdate({
        target: learningPaths.slug,
        set: { name: path.name, description: path.description, position: path.position },
      })
      .returning();

    for (const unit of path.units) {
      await d
        .insert(learningUnits)
        .values({
          pathId: pathRow!.id,
          conceptId: conceptIdBySlug.get(unit.conceptSlug) ?? null,
          slug: unit.slug,
          title: unit.title,
          depth: unit.depth,
          position: unit.position,
          objective: unit.objective,
          explanation: unit.explanation,
          structuredModel: unit.structuredModel,
          keyTerms: unit.keyTerms,
          coreMetricSlugs: unit.coreMetricSlugs,
          exampleCompanyNames: unit.exampleCompanyNames,
          commonMisconceptions: unit.commonMisconceptions,
          practicalQuestions: unit.practicalQuestions,
          sourceRefs: unit.sourceRefs,
          knowledgeCheck: unit.knowledgeCheck ?? null,
          estimatedMinutes: unit.estimatedMinutes,
          lastReviewedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: learningUnits.slug,
          set: {
            title: unit.title,
            objective: unit.objective,
            explanation: unit.explanation,
            structuredModel: unit.structuredModel,
            keyTerms: unit.keyTerms,
            commonMisconceptions: unit.commonMisconceptions,
            practicalQuestions: unit.practicalQuestions,
            knowledgeCheck: unit.knowledgeCheck ?? null,
            lastReviewedAt: new Date(),
            updatedAt: new Date(),
          },
        });
      unitCount++;
    }
  }
  counts.learningPaths = LEARNING_PATHS.length;
  counts.learningUnits = unitCount;

  // ── Entities ──────────────────────────────────────────────────────────────

  const entityIdBySlug = new Map<string, string>();
  let aliasCount = 0;

  for (const ent of ENTITIES) {
    const [row] = await d
      .insert(entities)
      .values({
        kind: ent.kind,
        slug: ent.slug,
        name: ent.name,
        legalName: ent.legalName ?? '',
        description: ent.description,
        officialDomain: ent.officialDomain,
        ticker: ent.ticker ?? '',
        headquartersGeographySlug: ent.hq ?? '',
        primaryIndustrySlug: undefined as never,
        primaryIndustryId: ent.primaryIndustrySlug
          ? industryIdBySlug.get(ent.primaryIndustrySlug)
          : null,
        businessModelSlug: ent.businessModelSlug ?? '',
        isDemo: ent.isDemo ?? false,
      } as never)
      /*
       * Every seed-owned field, not just the ones that happened to be listed.
       *
       * `legalName`, `ticker`, headquarters, business model and industry were all
       * missing from this list, so editing any of them in the seed had no effect on a
       * database that already existed — the insert was skipped and the update did not
       * mention them. Adding a registered name for Hermès changed nothing at all, and
       * nothing said so.
       *
       * That was survivable while every run started from an empty database. Since the
       * corpus is carried between runs, an existing database is now the normal case and
       * a curated field that silently never lands is the normal outcome.
       *
       * `publicProfile` is deliberately absent: it belongs to the EDGAR and ESEF
       * connectors, and resetting it here would blank the financials on every seed.
       */
      .onConflictDoUpdate({
        target: entities.slug,
        set: {
          name: ent.name,
          legalName: ent.legalName ?? '',
          description: ent.description,
          officialDomain: ent.officialDomain,
          ticker: ent.ticker ?? '',
          headquartersGeographySlug: ent.hq ?? '',
          businessModelSlug: ent.businessModelSlug ?? '',
          primaryIndustryId: ent.primaryIndustrySlug
            ? (industryIdBySlug.get(ent.primaryIndustrySlug) ?? null)
            : null,
          kind: ent.kind,
          isDemo: ent.isDemo ?? false,
          updatedAt: new Date(),
        } as never,
      })
      .returning();
    entityIdBySlug.set(ent.slug, row!.id);

    for (const alias of ent.aliases) {
      const normalized = normalizeAlias(alias.alias);
      await d
        .insert(entityAliases)
        .values({
          entityId: row!.id,
          alias: alias.alias,
          normalized,
          language: alias.language ?? 'en',
          aliasType: alias.type ?? 'trade',
          requiresContext: alias.requiresContext ?? aliasNeedsContext(alias.alias),
        })
        .onConflictDoNothing();
      aliasCount++;
    }

    for (const slug of ent.industrySlugs ?? []) {
      const industryId = industryIdBySlug.get(slug);
      if (!industryId) continue;
      await d
        .insert(entityIndustries)
        .values({ entityId: row!.id, industryId, isPrimary: slug === ent.primaryIndustrySlug })
        .onConflictDoNothing();
    }
  }
  counts.entities = ENTITIES.length;
  counts.entityAliases = aliasCount;

  // ── Sources, policies, connectors ─────────────────────────────────────────

  for (const src of SOURCES) {
    const [row] = await d
      .insert(sources)
      .values({
        slug: src.slug,
        name: src.name,
        officialDomain: src.officialDomain,
        homepageUrl: src.homepageUrl,
        sourceType: src.sourceType as never,
        perspective: src.perspective as never,
        sourceOwner: src.sourceOwner,
        subjectEntityId: src.subjectEntitySlug
          ? (entityIdBySlug.get(src.subjectEntitySlug) ?? null)
          : null,
        language: src.language,
        geographySlugs: src.geographySlugs,
        industrySlugs: src.industrySlugs,
        qualityScore: src.qualityScore,
        isDemo: src.isDemo ?? false,
        notes: src.notes,
      })
      .onConflictDoUpdate({
        target: sources.slug,
        set: {
          name: src.name,
          notes: src.notes,
          qualityScore: src.qualityScore,
          perspective: src.perspective as never,
          updatedAt: new Date(),
        },
      })
      .returning();

    await d
      .insert(sourcePolicies)
      .values({
        sourceId: row!.id,
        rightsStatus: src.policy.rightsStatus as never,
        allowedToIngest: src.policy.allowedToIngest,
        allowedToStoreMetadata: src.policy.allowedToStoreMetadata,
        allowedToStoreExcerpts: src.policy.allowedToStoreExcerpts,
        allowedToStoreFullText: src.policy.allowedToStoreFullText,
        allowedForAiProcessing: src.policy.allowedForAiProcessing,
        allowedForRedistribution: src.policy.allowedForRedistribution,
        storageScope: src.policy.storageScope as never,
        requiredAttribution: src.policy.requiredAttribution,
        rateLimitPerHour: src.policy.rateLimitPerHour,
        robotsAllows: src.policy.robotsAllows,
        robotsCheckedAt: src.policy.robotsAllows === null ? null : new Date(),
        termsUrl: src.policy.termsUrl,
        termsLastReviewedAt: new Date(),
        reviewedBy: src.policy.reviewedBy,
        reviewNotes: src.policy.reviewNotes,
        licenseStatus: src.policy.licenseStatus,
      })
      .onConflictDoUpdate({
        target: sourcePolicies.sourceId,
        set: {
          rightsStatus: src.policy.rightsStatus as never,
          allowedToIngest: src.policy.allowedToIngest,
          reviewNotes: src.policy.reviewNotes,
          storageScope: src.policy.storageScope as never,
          updatedAt: new Date(),
        },
      });

    const existingConnector = await d.query.sourceConnectors.findFirst({
      where: eq(sourceConnectors.sourceId, row!.id),
    });

    const configuration =
      src.connector.type !== 'demo'
        ? {}
        : {
            documents:
              src.connector.endpoint === 'fixtures-independent'
                ? DEMO_INDEPENDENT_DOCUMENTS
                : DEMO_FIRST_PARTY_DOCUMENTS,
          };

    if (existingConnector) {
      await d
        .update(sourceConnectors)
        .set({
          endpoint: src.connector.endpoint,
          isActive: src.connector.isActive && src.policy.allowedToIngest,
          schedule: src.connector.schedule,
          configuration,
          health:
            src.connector.isActive && src.policy.allowedToIngest
              ? existingConnector.health
              : 'disabled',
          updatedAt: new Date(),
        })
        .where(eq(sourceConnectors.id, existingConnector.id));
    } else {
      await d.insert(sourceConnectors).values({
        sourceId: row!.id,
        connectorType: src.connector.type as never,
        endpoint: src.connector.endpoint,
        // Belt and braces: a connector cannot be active if the policy forbids ingestion.
        isActive: src.connector.isActive && src.policy.allowedToIngest,
        schedule: src.connector.schedule,
        configuration,
        health: src.connector.isActive && src.policy.allowedToIngest ? 'healthy' : 'disabled',
      });
    }
  }
  counts.sources = SOURCES.length;

  // ── Organization, workspace, demo user ────────────────────────────────────

  const [org] = await d
    .insert(organizations)
    .values({ slug: 'default', name: 'Default Organization' })
    .onConflictDoUpdate({ target: organizations.slug, set: { name: 'Default Organization' } })
    .returning();

  const [workspace] = await d
    .insert(workspaces)
    .values({ organizationId: org!.id, slug: 'personal', name: 'Personal Workspace' })
    .onConflictDoUpdate({ target: workspaces.slug, set: { name: 'Personal Workspace' } })
    .returning();

  const existingUser = await d.query.users.findFirst({ where: eq(users.email, DEMO_EMAIL) });
  const userId =
    existingUser?.id ??
    (
      await d
        .insert(users)
        .values({
          email: DEMO_EMAIL,
          name: 'Demo User',
          passwordHash: await hashPassword(DEMO_PASSWORD),
          isDemo: true,
        })
        .returning()
    )[0]!.id;

  await d
    .insert(memberships)
    .values({ userId, workspaceId: workspace!.id, role: 'owner' })
    .onConflictDoNothing();

  await d
    .insert(userProfiles)
    .values({
      userId,
      workspaceId: workspace!.id,
      role: 'Management consultant',
      seniority: 'manager',
      industrySlugs: ['fashion-apparel', 'retail', 'technology-ai'],
      topicSlugs: ['artificial-intelligence', 'agentic-ai', 'supply-chain', 'pricing'],
      technologySlugs: ['large-language-models', 'machine-learning-forecasting'],
      geographySlugs: ['europe', 'global'],
      informationGoals: [
        'industry_depth',
        'client_preparation',
        'technology_monitoring',
        'continuous_learning',
      ],
      learningObjectives: [
        'Understand fashion retail economics',
        'Distinguish AI announcements from deployments',
      ],
      dailyReadingMinutes: 12,
      preferredDepth: 'executive',
      responseLanguage: 'en',
      // This profile already carries industries, topics and a reading budget, so it is
      // onboarded by definition. Leaving it null sends the demo account through set-up
      // to re-enter what the seed just wrote.
      onboardingCompletedAt: new Date(),
    })
    .onConflictDoNothing();

  for (const kind of [
    'daily_brief_ready',
    'high_impact_watchlist_event',
    'important_correction',
    'weekly_learning_review',
  ] as const) {
    await d
      .insert(notificationPreferences)
      .values({ userId, workspaceId: workspace!.id, kind, enabled: true, threshold: 70 })
      .onConflictDoNothing();
  }

  // A starter watchlist. Consulting firms are deliberately not included by default —
  // the user can add them like any other company if they want to.
  const existingWatchlist = await d.query.watchlists.findFirst({
    where: eq(watchlists.workspaceId, workspace!.id),
  });
  const watchlistId =
    existingWatchlist?.id ??
    (
      await d
        .insert(watchlists)
        .values({ workspaceId: workspace!.id, userId, name: 'My companies', kind: 'company' })
        .returning()
    )[0]!.id;

  for (const slug of ['hm-group', 'inditex', 'zalando', 'nvidia', 'openai', 'microsoft']) {
    const entityId = entityIdBySlug.get(slug);
    if (!entityId) continue;
    const exists = await d.query.watchlistItems.findFirst({
      where: sql`${watchlistItems.watchlistId} = ${watchlistId} and ${watchlistItems.entityId} = ${entityId}`,
    });
    if (!exists) {
      await d.insert(watchlistItems).values({ watchlistId, entityId, relationship: 'interest' });
    }
  }

  log(
    `[seed] ${Object.entries(counts)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ')}`,
  );

  return {
    organizationId: org!.id,
    workspaceId: workspace!.id,
    userId,
    demoEmail: DEMO_EMAIL,
    demoPassword: DEMO_PASSWORD,
    counts,
  };
}
