/**
 * Source registry seed.
 *
 * Every entry records a rights review with a date and a note. The `rightsStatus` here
 * is a real decision, not decoration: `evaluateRights` refuses to fetch anything that
 * is not `approved` or `metadata_only`, so the candidates below with
 * `pending_review` genuinely do not run.
 *
 * Review basis for the approved entries (checked 2026-09-01):
 *   - each is a publisher-operated RSS/Atom feed, i.e. content the publisher has
 *     deliberately made machine-readable for syndication
 *   - each host's robots.txt was retrieved and contains no rule disallowing the feed
 *     path for a generic user agent
 *   - we store only what the feed itself returns; the article link is never followed
 *   - attribution and a link to the original are shown on every derived item
 *
 * Anything beyond that — full article text, paywalled material, licensed feeds —
 * requires a separate licence and is not enabled here.
 */

export interface SourceSeed {
  slug: string;
  name: string;
  officialDomain: string;
  homepageUrl: string;
  sourceType: string;
  perspective: string;
  sourceOwner: string;
  subjectEntitySlug?: string;
  language: string;
  geographySlugs: string[];
  industrySlugs: string[];
  qualityScore: number;
  isDemo?: boolean;
  notes: string;
  connector: {
    type: string;
    endpoint: string;
    isActive: boolean;
    schedule: string;
  };
  policy: {
    rightsStatus: string;
    allowedToIngest: boolean;
    allowedToStoreMetadata: boolean;
    allowedToStoreExcerpts: boolean;
    allowedToStoreFullText: boolean;
    allowedForAiProcessing: boolean;
    allowedForRedistribution: boolean;
    storageScope: string;
    requiredAttribution: string;
    rateLimitPerHour: number;
    robotsAllows: boolean | null;
    termsUrl: string;
    reviewedBy: string;
    reviewNotes: string;
    licenseStatus: string;
  };
}

const REVIEWER = 'seed/rights-review-2026-09-01';

/** Publisher feed, verified reachable and parseable on 2026-09-01. */
function approvedFeed(overrides: Partial<SourceSeed['policy']> = {}): SourceSeed['policy'] {
  return {
    rightsStatus: 'approved',
    allowedToIngest: true,
    allowedToStoreMetadata: true,
    // The feed's own summary is what the publisher chose to syndicate.
    allowedToStoreExcerpts: true,
    // We never retain a full article: the feed body is the limit.
    allowedToStoreFullText: false,
    allowedForAiProcessing: true,
    allowedForRedistribution: false,
    storageScope: 'excerpt',
    requiredAttribution: '',
    rateLimitPerHour: 12,
    robotsAllows: true,
    termsUrl: '',
    reviewedBy: REVIEWER,
    reviewNotes:
      'Publisher-operated RSS feed. robots.txt retrieved 2026-09-01, no rule disallows the feed path. Feed summary retained as excerpt; article body is never fetched. Attribution and original link shown on every derived item.',
    licenseStatus: 'publisher_feed_no_licence_required',
    ...overrides,
  };
}

/** Registered as a candidate. Connector stays off until a review completes. */
function pendingReview(reason: string): SourceSeed['policy'] {
  return {
    rightsStatus: 'pending_review',
    allowedToIngest: false,
    allowedToStoreMetadata: true,
    allowedToStoreExcerpts: false,
    allowedToStoreFullText: false,
    allowedForAiProcessing: false,
    allowedForRedistribution: false,
    storageScope: 'metadata',
    requiredAttribution: '',
    rateLimitPerHour: 6,
    robotsAllows: null,
    termsUrl: '',
    reviewedBy: REVIEWER,
    reviewNotes: reason,
    licenseStatus: 'none',
  };
}

export const SOURCES: SourceSeed[] = [
  // ── Active: first-party technology providers ──────────────────────────────
  {
    slug: 'nvidia-newsroom',
    name: 'NVIDIA Newsroom',
    officialDomain: 'nvidianews.nvidia.com',
    homepageUrl: 'https://nvidianews.nvidia.com/',
    sourceType: 'official_newsroom',
    perspective: 'FIRST_PARTY_TECH_PROVIDER',
    sourceOwner: 'NVIDIA Corporation',
    subjectEntitySlug: 'nvidia',
    language: 'en',
    geographySlugs: ['global', 'united-states'],
    industrySlugs: ['technology-ai'],
    qualityScore: 70,
    notes: 'Company announcements. First-party: describes intent and self-reported outcomes.',
    connector: {
      type: 'rss',
      endpoint: 'https://nvidianews.nvidia.com/releases.xml',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed(),
  },
  {
    slug: 'microsoft-news',
    name: 'Microsoft News',
    officialDomain: 'news.microsoft.com',
    homepageUrl: 'https://news.microsoft.com/',
    sourceType: 'official_newsroom',
    perspective: 'FIRST_PARTY_TECH_PROVIDER',
    sourceOwner: 'Microsoft Corporation',
    subjectEntitySlug: 'microsoft',
    language: 'en',
    geographySlugs: ['global', 'united-states'],
    industrySlugs: ['technology-ai'],
    qualityScore: 70,
    notes: 'Company announcements.',
    connector: {
      type: 'rss',
      endpoint: 'https://news.microsoft.com/feed/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed(),
  },
  {
    slug: 'google-blog',
    name: 'Google — The Keyword',
    officialDomain: 'blog.google',
    homepageUrl: 'https://blog.google/',
    sourceType: 'official_blog',
    perspective: 'FIRST_PARTY_TECH_PROVIDER',
    sourceOwner: 'Google LLC',
    subjectEntitySlug: 'google',
    language: 'en',
    geographySlugs: ['global', 'united-states'],
    industrySlugs: ['technology-ai'],
    qualityScore: 68,
    notes: 'Official product and research blog.',
    connector: {
      type: 'rss',
      endpoint: 'https://blog.google/rss/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed(),
  },
  {
    slug: 'openai-news',
    name: 'OpenAI News',
    officialDomain: 'openai.com',
    homepageUrl: 'https://openai.com/news/',
    sourceType: 'official_newsroom',
    perspective: 'FIRST_PARTY_TECH_PROVIDER',
    sourceOwner: 'OpenAI',
    subjectEntitySlug: 'openai',
    language: 'en',
    geographySlugs: ['global', 'united-states'],
    industrySlugs: ['technology-ai'],
    qualityScore: 70,
    notes: 'Company announcements and research posts.',
    connector: {
      type: 'rss',
      endpoint: 'https://openai.com/news/rss.xml',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed(),
  },
  {
    slug: 'meta-newsroom',
    name: 'Meta Newsroom',
    officialDomain: 'about.fb.com',
    homepageUrl: 'https://about.fb.com/news/',
    sourceType: 'official_newsroom',
    perspective: 'FIRST_PARTY_TECH_PROVIDER',
    sourceOwner: 'Meta Platforms, Inc.',
    subjectEntitySlug: 'meta',
    language: 'en',
    geographySlugs: ['global', 'united-states'],
    industrySlugs: ['technology-ai'],
    qualityScore: 65,
    notes: 'Company announcements.',
    connector: {
      type: 'rss',
      endpoint: 'https://about.fb.com/news/feed/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed(),
  },
  {
    slug: 'aws-ml-blog',
    name: 'AWS Machine Learning Blog',
    officialDomain: 'aws.amazon.com',
    homepageUrl: 'https://aws.amazon.com/blogs/machine-learning/',
    sourceType: 'official_blog',
    perspective: 'FIRST_PARTY_TECH_PROVIDER',
    sourceOwner: 'Amazon Web Services',
    subjectEntitySlug: 'amazon',
    language: 'en',
    geographySlugs: ['global', 'united-states'],
    industrySlugs: ['technology-ai'],
    qualityScore: 62,
    notes: 'Technical and customer-deployment posts. Customer stories here are vendor-authored.',
    connector: {
      type: 'rss',
      endpoint: 'https://aws.amazon.com/blogs/machine-learning/feed/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed(),
  },

  // ── Active: first-party retail / fashion ──────────────────────────────────
  {
    slug: 'hm-group-news',
    name: 'H&M Group News',
    officialDomain: 'hmgroup.com',
    homepageUrl: 'https://hmgroup.com/news/',
    sourceType: 'official_newsroom',
    perspective: 'FIRST_PARTY_COMPANY',
    sourceOwner: 'H & M Hennes & Mauritz AB',
    subjectEntitySlug: 'hm-group',
    language: 'en',
    geographySlugs: ['global', 'europe', 'sweden'],
    industrySlugs: ['fashion-apparel', 'retail'],
    qualityScore: 68,
    notes: 'Corporate news and results announcements. First-party throughout.',
    connector: {
      type: 'rss',
      endpoint: 'https://hmgroup.com/feed/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed(),
  },

  // ── Active: independent and industry media ────────────────────────────────
  {
    slug: 'retail-dive',
    name: 'Retail Dive',
    officialDomain: 'www.retaildive.com',
    homepageUrl: 'https://www.retaildive.com/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'Industry Dive',
    language: 'en',
    geographySlugs: ['united-states', 'north-america'],
    industrySlugs: ['retail', 'consumer-goods', 'fashion-apparel'],
    qualityScore: 72,
    notes:
      'Independent trade publication. Provides the non-first-party perspective needed for corroboration.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.retaildive.com/feeds/news/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      requiredAttribution: 'Retail Dive',
      reviewNotes:
        'Publisher-operated RSS feed. robots.txt retrieved 2026-09-01: 15 disallow rules, none covering /feeds/. Feed summary retained as excerpt only; the article page is never fetched. Publisher attribution is required and is shown on every derived item.',
    }),
  },

  // ── Active: regulators and public institutions ────────────────────────────
  {
    slug: 'european-commission-press',
    name: 'European Commission — Press Corner',
    officialDomain: 'ec.europa.eu',
    homepageUrl: 'https://ec.europa.eu/commission/presscorner/',
    sourceType: 'regulator',
    perspective: 'REGULATOR',
    sourceOwner: 'European Commission',
    subjectEntitySlug: 'european-commission',
    language: 'en',
    geographySlugs: ['europe'],
    industrySlugs: ['retail', 'fashion-apparel', 'consumer-goods', 'technology-ai'],
    qualityScore: 85,
    notes: 'Official EU announcements. Primary source for regulatory developments.',
    connector: {
      type: 'rss',
      endpoint: 'https://ec.europa.eu/commission/presscorner/api/rss?language=en&pagesize=20',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      rateLimitPerHour: 6,
      reviewNotes:
        'Official EU institutional feed, published for reuse. robots.txt retrieved 2026-09-01; no rule disallows the presscorner API feed. EU documents are generally reusable under the Commission reuse policy with source acknowledgement.',
    }),
  },
  {
    slug: 'nist-news',
    name: 'NIST News',
    officialDomain: 'www.nist.gov',
    homepageUrl: 'https://www.nist.gov/news-events/news',
    sourceType: 'public_institution',
    perspective: 'PUBLIC_INSTITUTION',
    sourceOwner: 'National Institute of Standards and Technology',
    subjectEntitySlug: 'nist',
    language: 'en',
    geographySlugs: ['united-states'],
    industrySlugs: ['technology-ai'],
    qualityScore: 82,
    notes: 'US standards body. Primary source for AI risk management and measurement standards.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.nist.gov/news-events/news/rss.xml',
      isActive: true,
      schedule: 'weekly',
    },
    policy: approvedFeed({
      rateLimitPerHour: 4,
      reviewNotes:
        'US federal agency feed. Works of the US government are generally not subject to domestic copyright. robots.txt retrieved 2026-09-01; no rule disallows the feed path.',
    }),
  },

  // ── Active: consulting and professional services ──────────────────────────
  // Registered through exactly the same mechanism as every other source, with the
  // same rules and no ranking advantage anywhere downstream.
  {
    slug: 'mckinsey-insights',
    name: 'McKinsey Insights',
    officialDomain: 'www.mckinsey.com',
    homepageUrl: 'https://www.mckinsey.com/featured-insights',
    sourceType: 'research_report',
    perspective: 'FIRST_PARTY_CONSULTING_FIRM',
    sourceOwner: 'McKinsey & Company',
    subjectEntitySlug: 'mckinsey',
    language: 'en',
    geographySlugs: ['global'],
    industrySlugs: ['retail', 'consumer-goods', 'technology-ai'],
    qualityScore: 60,
    notes:
      'Consulting-firm publications. First-party: the firm has a commercial interest in the conclusions. Useful as a signal of what is being sold, not as independent market evidence.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.mckinsey.com/insights/rss',
      isActive: true,
      schedule: 'weekly',
    },
    policy: approvedFeed({
      requiredAttribution: 'McKinsey & Company',
      reviewNotes:
        'Publisher-operated RSS feed. robots.txt retrieved 2026-09-01: 38 disallow rules, none covering /insights/rss. Feed summary retained as excerpt only. Marked FIRST_PARTY_CONSULTING_FIRM so its claims are never treated as independent confirmation.',
    }),
  },

  // ── Candidates: registered, reviewed, not running ─────────────────────────
  {
    slug: 'accenture-newsroom',
    name: 'Accenture Newsroom',
    officialDomain: 'newsroom.accenture.com',
    homepageUrl: 'https://newsroom.accenture.com',
    sourceType: 'official_newsroom',
    perspective: 'FIRST_PARTY_CONSULTING_FIRM',
    sourceOwner: 'Accenture plc',
    subjectEntitySlug: 'accenture',
    language: 'en',
    geographySlugs: ['global'],
    industrySlugs: ['technology-ai'],
    qualityScore: 60,
    notes:
      'Optional source candidate. Registered so it can be enabled if a feed endpoint is confirmed — it holds no privileged position in ranking or in the daily brief.',
    connector: {
      type: 'rss',
      endpoint: 'https://newsroom.accenture.com/rss/news-releases.xml',
      isActive: false,
      schedule: 'daily',
    },
    policy: pendingReview(
      'No working feed endpoint found. Probed 2026-09-01: /rss/news-releases.xml, /rss/, /news/rss, /subjects/all/rss.xml and /feed/ all returned HTTP 404. Registered as a candidate. Enabling it requires (a) a confirmed publisher feed URL and (b) a terms review — not a scraper.',
    ),
  },
  {
    slug: 'anthropic-news',
    name: 'Anthropic News',
    officialDomain: 'anthropic.com',
    homepageUrl: 'https://www.anthropic.com/news',
    sourceType: 'official_newsroom',
    perspective: 'FIRST_PARTY_TECH_PROVIDER',
    sourceOwner: 'Anthropic PBC',
    subjectEntitySlug: 'anthropic',
    language: 'en',
    geographySlugs: ['global'],
    industrySlugs: ['technology-ai'],
    qualityScore: 68,
    notes: 'Source candidate.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.anthropic.com/rss.xml',
      isActive: false,
      schedule: 'daily',
    },
    policy: pendingReview(
      'No working feed endpoint found. Probed 2026-09-01: /rss.xml, /news/rss.xml and /news/feed.xml returned HTTP 404. Registered as a candidate pending a confirmed feed URL.',
    ),
  },
  {
    slug: 'inditex-press',
    name: 'Inditex Press Releases',
    officialDomain: 'www.inditex.com',
    homepageUrl: 'https://www.inditex.com/itxcomweb/en/communication',
    sourceType: 'official_newsroom',
    perspective: 'FIRST_PARTY_COMPANY',
    sourceOwner: 'Industria de Diseño Textil, S.A.',
    subjectEntitySlug: 'inditex',
    language: 'en',
    geographySlugs: ['europe', 'spain'],
    industrySlugs: ['fashion-apparel', 'retail'],
    qualityScore: 68,
    notes: 'Source candidate — a significant coverage gap for fashion while unavailable.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.inditex.com/itxcomweb/api/rss/en/press-releases',
      isActive: false,
      schedule: 'daily',
    },
    policy: pendingReview(
      'No working feed endpoint found. Probed 2026-09-01: the RSS API path returned HTTP 404 and /itxcomweb/en/rss returned HTML rather than a feed. Not enabled. Page scraping is not an acceptable substitute and is not implemented.',
    ),
  },
  {
    slug: 'zalando-corporate',
    name: 'Zalando Corporate Newsroom',
    officialDomain: 'corporate.zalando.com',
    homepageUrl: 'https://corporate.zalando.com/en/newsroom',
    sourceType: 'official_newsroom',
    perspective: 'FIRST_PARTY_COMPANY',
    sourceOwner: 'Zalando SE',
    subjectEntitySlug: 'zalando',
    language: 'en',
    geographySlugs: ['europe', 'germany'],
    industrySlugs: ['fashion-apparel', 'retail'],
    qualityScore: 66,
    notes: 'Source candidate.',
    connector: {
      type: 'rss',
      endpoint: 'https://corporate.zalando.com/en/rss.xml',
      isActive: false,
      schedule: 'daily',
    },
    policy: pendingReview(
      'No working feed endpoint found. Probed 2026-09-01: /en/rss.xml and /en/newsroom/rss.xml returned HTTP 404.',
    ),
  },
  {
    slug: 'sec-edgar',
    name: 'SEC EDGAR Filings',
    officialDomain: 'www.sec.gov',
    homepageUrl: 'https://www.sec.gov/edgar',
    sourceType: 'regulatory_filing',
    perspective: 'REGULATOR',
    sourceOwner: 'US Securities and Exchange Commission',
    language: 'en',
    geographySlugs: ['united-states'],
    industrySlugs: ['retail', 'consumer-goods', 'technology-ai'],
    qualityScore: 95,
    notes:
      'The highest-value primary source for US-listed companies: legally attested rather than self-promotional. Requires a filing-API connector, which is not implemented in this MVP.',
    connector: {
      type: 'filing_api',
      endpoint: 'https://data.sec.gov/submissions/',
      isActive: false,
      schedule: 'daily',
    },
    policy: pendingReview(
      'Blocked by an unimplemented connector, not by rights. EDGAR permits automated access under a declared user agent and rate limit. Implementing the filing_api connector is the top-priority source expansion.',
    ),
  },
  {
    slug: 'manual-url-ingestion',
    name: 'Manual URL Ingestion',
    officialDomain: '',
    homepageUrl: '',
    sourceType: 'user_upload',
    perspective: 'USER_PROVIDED',
    sourceOwner: 'Workspace user',
    language: 'en',
    geographySlugs: ['global'],
    industrySlugs: [],
    qualityScore: 40,
    notes:
      'Pages a user explicitly submits. Marked USER_PROVIDED so nothing ingested this way is ever presented as an independently verified source.',
    connector: { type: 'manual_url', endpoint: 'manual', isActive: true, schedule: 'on_demand' },
    policy: {
      rightsStatus: 'approved',
      allowedToIngest: true,
      allowedToStoreMetadata: true,
      allowedToStoreExcerpts: true,
      allowedToStoreFullText: false,
      allowedForAiProcessing: true,
      allowedForRedistribution: false,
      storageScope: 'excerpt',
      requiredAttribution: 'Original publisher as shown on the submitted page',
      rateLimitPerHour: 30,
      robotsAllows: null,
      termsUrl: '',
      reviewedBy: REVIEWER,
      reviewNotes:
        'User-initiated single-page fetch. Stores an excerpt for identification. No crawling, no link following, no access-control bypass. The submitting user is responsible for having the right to share the page, and the submission is recorded in the audit log.',
      licenseStatus: 'user_asserted',
    },
  },

  // ── Demo ──────────────────────────────────────────────────────────────────
  // Two demo sources with different perspectives, so the fixtures can demonstrate
  // corroboration across sources and the first-party / independent distinction —
  // which a single demo source cannot.
  {
    slug: 'demo-trade-press',
    name: 'Demo Trade Press (illustrative data)',
    officialDomain: 'demo.local',
    homepageUrl: '',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'NORTH demo data',
    language: 'en',
    geographySlugs: ['global'],
    industrySlugs: ['retail', 'fashion-apparel'],
    qualityScore: 30,
    isDemo: true,
    notes:
      'Illustrative fixtures representing independent trade coverage. Not real reporting. Everything derived from it carries a Demo badge.',
    connector: {
      type: 'demo',
      endpoint: 'fixtures-independent',
      isActive: true,
      schedule: 'daily',
    },
    policy: {
      rightsStatus: 'approved',
      allowedToIngest: true,
      allowedToStoreMetadata: true,
      allowedToStoreExcerpts: true,
      allowedToStoreFullText: true,
      allowedForAiProcessing: true,
      allowedForRedistribution: true,
      storageScope: 'full_text',
      requiredAttribution: 'Demo data — not a real source',
      rateLimitPerHour: 1000,
      robotsAllows: null,
      termsUrl: '',
      reviewedBy: REVIEWER,
      reviewNotes: 'Fixtures authored for this repository. No third-party rights involved.',
      licenseStatus: 'internal_demo',
    },
  },
  {
    slug: 'demo-fixtures',
    name: 'Demo Corporate Newsroom (illustrative data)',
    officialDomain: 'demo.local',
    homepageUrl: '',
    sourceType: 'user_upload',
    perspective: 'USER_PROVIDED',
    sourceOwner: 'NORTH demo data',
    language: 'en',
    geographySlugs: ['global'],
    industrySlugs: ['retail', 'fashion-apparel', 'technology-ai'],
    qualityScore: 30,
    isDemo: true,
    notes:
      'Illustrative fixtures representing company newsroom announcements. Not real reporting. Every event, insight and citation derived from it carries a Demo badge in the UI.',
    connector: { type: 'demo', endpoint: 'fixtures', isActive: true, schedule: 'daily' },
    policy: {
      rightsStatus: 'approved',
      allowedToIngest: true,
      allowedToStoreMetadata: true,
      allowedToStoreExcerpts: true,
      allowedToStoreFullText: true,
      allowedForAiProcessing: true,
      allowedForRedistribution: true,
      storageScope: 'full_text',
      requiredAttribution: 'Demo data — not a real source',
      rateLimitPerHour: 1000,
      robotsAllows: null,
      termsUrl: '',
      reviewedBy: REVIEWER,
      reviewNotes: 'Fixtures authored for this repository. No third-party rights involved.',
      licenseStatus: 'internal_demo',
    },
  },
];
