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
    /*
     * Deliberately empty, and it matters.
     *
     * This used to read ['retail', 'fashion-apparel', 'consumer-goods', 'technology-ai']
     * — true in the sense that the Commission regulates all four, and false in the sense
     * the pipeline used it: an event whose text names no industry inherits its source's
     * list, so every NATO statement, Arctic Forum speech and G20 communiqué published
     * here was filed as retail *and* fashion news. Retail's 86 events were mostly EU
     * press releases about something else.
     *
     * A general institution is not about a sector. Leaving this empty means its items
     * stay untagged unless their own text says otherwise, which is the honest result.
     */
    industrySlugs: [],
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

  /*
   * ── Trade press and quality news, added 2026-09-04 ────────────────────────
   *
   * The registry was nineteen sources, and fourteen of them were technology vendors or
   * EU institutions. That is why twelve of seventeen markets held nothing: not because
   * those markets were quiet, but because nobody was watching them. Tobacco had no
   * source at all, so "no results" was the only answer it could ever give.
   *
   * Corporate newsrooms were tried first and mostly refuse: Philip Morris, JTI, BAT,
   * Nestlé, Unilever, Tesco, REWE, Migros, Ecolab and Estée Lauder all return 403, 404
   * or 429 to a feed request. Trade publications and quality news are what actually
   * cover these sectors, and they are independent besides — a company newsroom can only
   * ever corroborate itself.
   *
   * Every endpoint below was fetched on 2026-09-04 and returned a parseable feed with
   * items. Subscription publications are registered but left off pending a licence
   * review: their feeds are public, their terms are not obviously compatible with
   * storing excerpts, and guessing is not a rights decision.
   */

  // ── Tobacco & nicotine ────────────────────────────────────────────────────
  {
    slug: 'tobacco-reporter',
    name: 'Tobacco Reporter',
    officialDomain: 'tobaccoreporter.com',
    homepageUrl: 'https://tobaccoreporter.com/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'SpecComm International',
    language: 'en',
    geographySlugs: ['global'],
    industrySlugs: ['tobacco'],
    qualityScore: 60,
    notes:
      'Trade publication covering tobacco, heated products and nicotine regulation. The first source registered against this sector.',
    connector: {
      type: 'rss',
      endpoint: 'https://tobaccoreporter.com/feed/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes:
        'Publisher-operated feed, fetched 2026-09-04 and returning full item metadata. Excerpt only; the article link is never followed.',
    }),
  },
  {
    slug: 'tobacco-journal',
    name: 'Tobacco Journal International',
    officialDomain: 'www.tobaccojournal.com',
    homepageUrl: 'https://www.tobaccojournal.com/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'Tobacco Journal International',
    language: 'en',
    geographySlugs: ['global', 'europe'],
    industrySlugs: ['tobacco'],
    qualityScore: 58,
    notes: 'European trade coverage of the tobacco and nicotine industry.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.tobaccojournal.com/feed',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes: 'Publisher-operated feed, fetched 2026-09-04, 20 items. Excerpt only.',
    }),
  },

  // ── Food, beverage and grocery ────────────────────────────────────────────
  {
    slug: 'food-dive',
    name: 'Food Dive',
    officialDomain: 'www.fooddive.com',
    homepageUrl: 'https://www.fooddive.com/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'Industry Dive',
    language: 'en',
    geographySlugs: ['united-states', 'north-america'],
    industrySlugs: ['food-beverage', 'consumer-goods'],
    qualityScore: 70,
    notes: 'Sister publication to Retail Dive, covering food manufacturing and brands.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.fooddive.com/feeds/news/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes:
        'Same publisher and feed conventions as the already-approved Retail Dive entry. Fetched 2026-09-04.',
    }),
  },
  {
    slug: 'just-food',
    name: 'Just Food',
    officialDomain: 'www.just-food.com',
    homepageUrl: 'https://www.just-food.com/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'GlobalData',
    language: 'en',
    geographySlugs: ['global'],
    industrySlugs: ['food-beverage', 'consumer-goods'],
    qualityScore: 66,
    notes: 'Global food industry news, including M&A and supply chain.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.just-food.com/feed/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes: 'Publisher-operated feed, fetched 2026-09-04, 10 items. Excerpt only.',
    }),
  },
  {
    slug: 'grocery-gazette',
    name: 'Grocery Gazette',
    officialDomain: 'www.grocerygazette.co.uk',
    homepageUrl: 'https://www.grocerygazette.co.uk/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'Grocery Gazette',
    language: 'en',
    geographySlugs: ['united-kingdom', 'europe'],
    industrySlugs: ['retail', 'food-beverage'],
    qualityScore: 58,
    notes: 'UK grocery retail, including the discounters and own-label.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.grocerygazette.co.uk/feed/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes: 'Publisher-operated feed, fetched 2026-09-04, 10 items. Excerpt only.',
    }),
  },
  {
    slug: 'guardian-supermarkets',
    name: 'The Guardian — Supermarkets',
    officialDomain: 'www.theguardian.com',
    homepageUrl: 'https://www.theguardian.com/business/supermarkets',
    sourceType: 'independent_news',
    perspective: 'INDEPENDENT_BUSINESS_MEDIA',
    sourceOwner: 'Guardian News & Media',
    language: 'en',
    geographySlugs: ['united-kingdom', 'europe'],
    industrySlugs: ['retail', 'food-beverage'],
    qualityScore: 78,
    notes: 'Independent reporting on grocery retail — the corroborating half of a company claim.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.theguardian.com/business/supermarkets/rss',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes:
        'Guardian publishes open RSS per section. Headline and standfirst only, attributed and linked; full text is never retained. Fetched 2026-09-04, 20 items.',
    }),
  },

  // ── Fashion and apparel ───────────────────────────────────────────────────
  {
    slug: 'drapers',
    name: 'Drapers',
    officialDomain: 'www.drapersonline.com',
    homepageUrl: 'https://www.drapersonline.com/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'Metropolis Business Media',
    language: 'en',
    geographySlugs: ['united-kingdom', 'europe'],
    industrySlugs: ['fashion-apparel', 'retail'],
    qualityScore: 64,
    notes: 'UK fashion retail trade press.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.drapersonline.com/feed',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes: 'Publisher-operated feed, fetched 2026-09-04, 10 items. Excerpt only.',
    }),
  },
  {
    slug: 'guardian-fashion',
    name: 'The Guardian — Fashion',
    officialDomain: 'www.theguardian.com',
    homepageUrl: 'https://www.theguardian.com/fashion',
    sourceType: 'independent_news',
    perspective: 'INDEPENDENT_BUSINESS_MEDIA',
    sourceOwner: 'Guardian News & Media',
    language: 'en',
    geographySlugs: ['united-kingdom', 'global'],
    industrySlugs: ['fashion-apparel'],
    qualityScore: 72,
    notes: 'Fashion industry coverage, including labour and sustainability reporting.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.theguardian.com/fashion/rss',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes: 'Open Guardian section feed. Fetched 2026-09-04, 33 items. Excerpt only.',
    }),
  },

  // ── Retail ────────────────────────────────────────────────────────────────
  {
    slug: 'guardian-retail',
    name: 'The Guardian — Retail',
    officialDomain: 'www.theguardian.com',
    homepageUrl: 'https://www.theguardian.com/business/retail',
    sourceType: 'independent_news',
    perspective: 'INDEPENDENT_BUSINESS_MEDIA',
    sourceOwner: 'Guardian News & Media',
    language: 'en',
    geographySlugs: ['united-kingdom', 'europe'],
    industrySlugs: ['retail'],
    qualityScore: 78,
    notes: 'Independent retail reporting, European rather than US-weighted.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.theguardian.com/business/retail/rss',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes: 'Open Guardian section feed. Fetched 2026-09-04, 20 items. Excerpt only.',
    }),
  },

  // ── Travel and hospitality ────────────────────────────────────────────────
  {
    slug: 'skift',
    name: 'Skift',
    officialDomain: 'skift.com',
    homepageUrl: 'https://skift.com/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'Skift Inc.',
    language: 'en',
    geographySlugs: ['global'],
    industrySlugs: ['travel'],
    qualityScore: 72,
    notes: 'Travel industry trade press. The first source registered against this sector.',
    connector: {
      type: 'rss',
      endpoint: 'https://skift.com/feed/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes: 'Publisher-operated feed, fetched 2026-09-04, 10 items. Excerpt only.',
    }),
  },

  /*
   * ── General business news ─────────────────────────────────────────────────
   *
   * Registered against no industry on purpose. These publish across the whole economy,
   * so lending their sector list to an untagged event is exactly the mistake that filled
   * Retail with EU press releases. They earn their place through corroboration: an
   * independent outlet reporting the same thing a company announced is what moves an
   * event from "announced" to "independently reported".
   */
  {
    slug: 'bbc-business',
    name: 'BBC News — Business',
    officialDomain: 'www.bbc.co.uk',
    homepageUrl: 'https://www.bbc.co.uk/news/business',
    sourceType: 'independent_news',
    perspective: 'INDEPENDENT_BUSINESS_MEDIA',
    sourceOwner: 'BBC',
    language: 'en',
    geographySlugs: ['united-kingdom', 'global'],
    industrySlugs: [],
    qualityScore: 82,
    notes: 'Cross-economy business reporting. Lends no industry; corroborates many.',
    connector: {
      type: 'rss',
      endpoint: 'https://feeds.bbci.co.uk/news/business/rss.xml',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes:
        'BBC publishes these feeds openly for reuse with attribution and a link back. Headline and summary only. Fetched 2026-09-04, 46 items.',
    }),
  },
  {
    slug: 'guardian-business',
    name: 'The Guardian — Business',
    officialDomain: 'www.theguardian.com',
    homepageUrl: 'https://www.theguardian.com/uk/business',
    sourceType: 'independent_news',
    perspective: 'INDEPENDENT_BUSINESS_MEDIA',
    sourceOwner: 'Guardian News & Media',
    language: 'en',
    geographySlugs: ['united-kingdom', 'europe'],
    industrySlugs: [],
    qualityScore: 78,
    notes: 'Cross-economy business reporting.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.theguardian.com/uk/business/rss',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes: 'Open Guardian section feed. Fetched 2026-09-04, 40 items. Excerpt only.',
    }),
  },
  {
    slug: 'cnbc-business',
    name: 'CNBC — Business News',
    officialDomain: 'www.cnbc.com',
    homepageUrl: 'https://www.cnbc.com/business/',
    sourceType: 'independent_news',
    perspective: 'INDEPENDENT_BUSINESS_MEDIA',
    sourceOwner: 'NBCUniversal',
    language: 'en',
    geographySlugs: ['united-states', 'global'],
    industrySlugs: [],
    qualityScore: 70,
    notes: 'US market and corporate news. Useful for earnings and deal corroboration.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.cnbc.com/id/10001147/device/rss/rss.html',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes: 'Publisher-operated feed, fetched 2026-09-04, 30 items. Excerpt only.',
    }),
  },

  /*
   * Subscription publications. Their feeds are public and were verified reachable, but
   * headline-and-summary reuse is not clearly within their terms and this project does
   * not guess about rights. Registered so the gap is visible and the decision is one
   * licence away, with the connector off until then.
   */
  {
    slug: 'ft-companies',
    name: 'Financial Times',
    officialDomain: 'www.ft.com',
    homepageUrl: 'https://www.ft.com/companies',
    sourceType: 'independent_news',
    perspective: 'LICENSED_PREMIUM',
    sourceOwner: 'The Financial Times Ltd',
    language: 'en',
    geographySlugs: ['united-kingdom', 'global'],
    industrySlugs: [],
    qualityScore: 90,
    notes: 'Feed reachable 2026-09-04 (25 items). Off pending a licence decision.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.ft.com/business-education?format=rss',
      isActive: false,
      schedule: 'daily',
    },
    policy: pendingReview(
      'Subscription publication. Feed verified reachable 2026-09-04, but FT terms restrict reuse of headlines and summaries without a licence. Not ingested.',
    ),
  },
  {
    slug: 'economist-business',
    name: 'The Economist — Business',
    officialDomain: 'www.economist.com',
    homepageUrl: 'https://www.economist.com/business',
    sourceType: 'independent_news',
    perspective: 'LICENSED_PREMIUM',
    sourceOwner: 'The Economist Group',
    language: 'en',
    geographySlugs: ['global'],
    industrySlugs: [],
    qualityScore: 88,
    notes: 'Feed reachable 2026-09-04 (300 items). Off pending a licence decision.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.economist.com/business/rss.xml',
      isActive: false,
      schedule: 'daily',
    },
    policy: pendingReview(
      'Subscription publication. Feed verified reachable 2026-09-04; reuse of summaries requires a licence. Not ingested.',
    ),
  },
  {
    slug: 'nyt-business',
    name: 'The New York Times — Business',
    officialDomain: 'www.nytimes.com',
    homepageUrl: 'https://www.nytimes.com/section/business',
    sourceType: 'independent_news',
    perspective: 'LICENSED_PREMIUM',
    sourceOwner: 'The New York Times Company',
    language: 'en',
    geographySlugs: ['united-states', 'global'],
    industrySlugs: [],
    qualityScore: 88,
    notes: 'Feed reachable 2026-09-04 (50 items). Off pending a licence decision.',
    connector: {
      type: 'rss',
      endpoint: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',
      isActive: false,
      schedule: 'daily',
    },
    policy: pendingReview(
      'Subscription publication. NYT terms require a licence for systematic reuse of feed content. Not ingested.',
    ),
  },
  {
    slug: 'wsj-markets',
    name: 'The Wall Street Journal — Markets',
    officialDomain: 'www.wsj.com',
    homepageUrl: 'https://www.wsj.com/news/markets',
    sourceType: 'independent_news',
    perspective: 'LICENSED_PREMIUM',
    sourceOwner: 'Dow Jones & Company',
    language: 'en',
    geographySlugs: ['united-states', 'global'],
    industrySlugs: [],
    qualityScore: 88,
    notes: 'Feed reachable 2026-09-04 (20 items). Off pending a licence decision.',
    connector: {
      type: 'rss',
      endpoint: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',
      isActive: false,
      schedule: 'daily',
    },
    policy: pendingReview(
      'Subscription publication. Dow Jones terms require a licence for systematic reuse. Not ingested.',
    ),
  },

  /*
   * ── The rest of the economy, added 2026-09-04 ─────────────────────────────
   *
   * A tool called market intelligence that covers four sectors is a tool with an
   * opinion about which markets exist. These fill in the remaining twelve, so that a
   * question about automotive, banking, pharma or logistics gets an answer drawn from
   * somebody who actually reports on it.
   *
   * Every endpoint fetched 2026-09-04 and returning a parseable feed with items.
   * Each is registered against the sector it covers and nothing wider.
   */

  // ── Automotive & mobility ─────────────────────────────────────────────────
  {
    slug: 'just-auto',
    name: 'Just Auto',
    officialDomain: 'www.just-auto.com',
    homepageUrl: 'https://www.just-auto.com/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'GlobalData',
    language: 'en',
    geographySlugs: ['global'],
    industrySlugs: ['automotive'],
    qualityScore: 64,
    notes: 'Automotive manufacturing, suppliers and electrification.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.just-auto.com/feed/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({ reviewNotes: 'Publisher feed, fetched 2026-09-04, 10 items.' }),
  },
  {
    slug: 'guardian-automotive',
    name: 'The Guardian — Automotive',
    officialDomain: 'www.theguardian.com',
    homepageUrl: 'https://www.theguardian.com/business/automotive-industry',
    sourceType: 'independent_news',
    perspective: 'INDEPENDENT_BUSINESS_MEDIA',
    sourceOwner: 'Guardian News & Media',
    language: 'en',
    geographySlugs: ['united-kingdom', 'europe'],
    industrySlugs: ['automotive'],
    qualityScore: 76,
    notes: 'Independent automotive industry reporting.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.theguardian.com/business/automotive-industry/rss',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({ reviewNotes: 'Open Guardian section feed, 2026-09-04, 20 items.' }),
  },

  // ── Energy & utilities ────────────────────────────────────────────────────
  {
    slug: 'utility-dive',
    name: 'Utility Dive',
    officialDomain: 'www.utilitydive.com',
    homepageUrl: 'https://www.utilitydive.com/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'Industry Dive',
    language: 'en',
    geographySlugs: ['united-states', 'north-america'],
    industrySlugs: ['energy-utilities'],
    qualityScore: 70,
    notes: 'Power, grid and utility regulation.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.utilitydive.com/feeds/news/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({ reviewNotes: 'Same publisher as the approved Retail Dive entry.' }),
  },
  {
    slug: 'guardian-energy',
    name: 'The Guardian — Energy',
    officialDomain: 'www.theguardian.com',
    homepageUrl: 'https://www.theguardian.com/business/energy-industry',
    sourceType: 'independent_news',
    perspective: 'INDEPENDENT_BUSINESS_MEDIA',
    sourceOwner: 'Guardian News & Media',
    language: 'en',
    geographySlugs: ['united-kingdom', 'europe'],
    industrySlugs: ['energy-utilities'],
    qualityScore: 76,
    notes: 'European energy market and transition reporting.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.theguardian.com/business/energy-industry/rss',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({ reviewNotes: 'Open Guardian section feed, 2026-09-04, 20 items.' }),
  },

  // ── Financial services ────────────────────────────────────────────────────
  {
    slug: 'banking-dive',
    name: 'Banking Dive',
    officialDomain: 'www.bankingdive.com',
    homepageUrl: 'https://www.bankingdive.com/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'Industry Dive',
    language: 'en',
    geographySlugs: ['united-states', 'north-america'],
    industrySlugs: ['financial-services'],
    qualityScore: 70,
    notes: 'Retail and commercial banking, including supervision.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.bankingdive.com/feeds/news/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({ reviewNotes: 'Same publisher as the approved Retail Dive entry.' }),
  },
  {
    slug: 'finextra',
    name: 'Finextra',
    officialDomain: 'www.finextra.com',
    homepageUrl: 'https://www.finextra.com/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'Finextra Research',
    language: 'en',
    geographySlugs: ['global', 'europe'],
    industrySlugs: ['financial-services', 'technology-ai'],
    qualityScore: 66,
    notes: 'Financial technology and payments. High volume.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.finextra.com/rss/headlines.aspx',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({ reviewNotes: 'Publisher feed, fetched 2026-09-04, 55 items.' }),
  },

  // ── Healthcare & pharmaceuticals ──────────────────────────────────────────
  {
    slug: 'healthcare-dive',
    name: 'Healthcare Dive',
    officialDomain: 'www.healthcaredive.com',
    homepageUrl: 'https://www.healthcaredive.com/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'Industry Dive',
    language: 'en',
    geographySlugs: ['united-states', 'north-america'],
    industrySlugs: ['healthcare'],
    qualityScore: 70,
    notes: 'Providers, payers and health policy.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.healthcaredive.com/feeds/news/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({ reviewNotes: 'Same publisher as the approved Retail Dive entry.' }),
  },
  {
    slug: 'fierce-pharma',
    name: 'Fierce Pharma',
    officialDomain: 'www.fiercepharma.com',
    homepageUrl: 'https://www.fiercepharma.com/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'Questex',
    language: 'en',
    geographySlugs: ['global', 'united-states'],
    industrySlugs: ['pharmaceuticals'],
    qualityScore: 68,
    notes: 'Pharmaceutical manufacturers, approvals and commercial strategy.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.fiercepharma.com/rss/xml',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({ reviewNotes: 'Publisher feed, fetched 2026-09-04, 25 items.' }),
  },
  {
    slug: 'pharmaceutical-technology',
    name: 'Pharmaceutical Technology',
    officialDomain: 'www.pharmaceutical-technology.com',
    homepageUrl: 'https://www.pharmaceutical-technology.com/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'GlobalData',
    language: 'en',
    geographySlugs: ['global'],
    industrySlugs: ['pharmaceuticals'],
    qualityScore: 62,
    notes: 'Drug development, trials and manufacturing.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.pharmaceutical-technology.com/feed/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({ reviewNotes: 'Publisher feed, fetched 2026-09-04, 10 items.' }),
  },

  // ── Industrial manufacturing & logistics ──────────────────────────────────
  {
    slug: 'manufacturing-dive',
    name: 'Manufacturing Dive',
    officialDomain: 'www.manufacturingdive.com',
    homepageUrl: 'https://www.manufacturingdive.com/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'Industry Dive',
    language: 'en',
    geographySlugs: ['united-states', 'north-america'],
    industrySlugs: ['industrial-manufacturing'],
    qualityScore: 68,
    notes: 'Industrial production, automation and plant investment.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.manufacturingdive.com/feeds/news/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({ reviewNotes: 'Same publisher as the approved Retail Dive entry.' }),
  },
  {
    slug: 'supply-chain-dive',
    name: 'Supply Chain Dive',
    officialDomain: 'www.supplychaindive.com',
    homepageUrl: 'https://www.supplychaindive.com/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'Industry Dive',
    language: 'en',
    geographySlugs: ['united-states', 'global'],
    industrySlugs: ['logistics', 'retail', 'consumer-goods'],
    qualityScore: 70,
    notes:
      'Sourcing, freight and inventory. Registered against retail and consumer goods too, because supply chain is where those sectors actually move.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.supplychaindive.com/feeds/news/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({ reviewNotes: 'Same publisher as the approved Retail Dive entry.' }),
  },
  {
    slug: 'freightwaves',
    name: 'FreightWaves',
    officialDomain: 'www.freightwaves.com',
    homepageUrl: 'https://www.freightwaves.com/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'FreightWaves Inc.',
    language: 'en',
    geographySlugs: ['united-states', 'global'],
    industrySlugs: ['logistics'],
    qualityScore: 64,
    notes: 'Freight markets, carriers and rates. High volume.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.freightwaves.com/feed',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({ reviewNotes: 'Publisher feed, fetched 2026-09-04, 50 items.' }),
  },

  // ── Telecommunications ────────────────────────────────────────────────────
  {
    slug: 'mobile-world-live',
    name: 'Mobile World Live',
    officialDomain: 'www.mobileworldlive.com',
    homepageUrl: 'https://www.mobileworldlive.com/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'GSMA',
    language: 'en',
    geographySlugs: ['global'],
    industrySlugs: ['telecommunications'],
    qualityScore: 68,
    notes: 'Operator and network news from the GSMA. Covers Telstra and its peers.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.mobileworldlive.com/feed/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({ reviewNotes: 'Publisher feed, fetched 2026-09-04, 30 items.' }),
  },
  {
    slug: 'rcr-wireless',
    name: 'RCR Wireless News',
    officialDomain: 'www.rcrwireless.com',
    homepageUrl: 'https://www.rcrwireless.com/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'RCR Wireless News',
    language: 'en',
    geographySlugs: ['united-states', 'global'],
    industrySlugs: ['telecommunications'],
    qualityScore: 60,
    notes: 'Network infrastructure and spectrum.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.rcrwireless.com/feed',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({ reviewNotes: 'Publisher feed, fetched 2026-09-04, 10 items.' }),
  },

  // ── Media & entertainment ─────────────────────────────────────────────────
  {
    slug: 'hollywood-reporter',
    name: 'The Hollywood Reporter',
    officialDomain: 'www.hollywoodreporter.com',
    homepageUrl: 'https://www.hollywoodreporter.com/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'Penske Media Corporation',
    language: 'en',
    geographySlugs: ['united-states', 'global'],
    industrySlugs: ['media-entertainment'],
    qualityScore: 60,
    notes: 'Studios, streaming and the content business.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.hollywoodreporter.com/feed/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({ reviewNotes: 'Publisher feed, fetched 2026-09-04, 10 items.' }),
  },
  {
    slug: 'guardian-media',
    name: 'The Guardian — Media',
    officialDomain: 'www.theguardian.com',
    homepageUrl: 'https://www.theguardian.com/media',
    sourceType: 'independent_news',
    perspective: 'INDEPENDENT_BUSINESS_MEDIA',
    sourceOwner: 'Guardian News & Media',
    language: 'en',
    geographySlugs: ['united-kingdom', 'europe'],
    industrySlugs: ['media-entertainment'],
    qualityScore: 76,
    notes: 'Broadcasting, publishing and platform regulation.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.theguardian.com/media/rss',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({ reviewNotes: 'Open Guardian section feed, 2026-09-04, 13 items.' }),
  },

  /*
   * ── DACH and luxury, added 2026-09-04 ─────────────────────────────────────
   *
   * Every source above is British, American or "global", which in practice means
   * Anglophone. The consequence was measurable: across 1,135 claims, Migros, Rewe, Lidl,
   * MediaMarkt and adidas were mentioned exactly zero times, Coop once and Aldi four
   * times. A tool that watches the Anglo-American retail world is not much use to someone
   * whose accounts are Swiss and German.
   *
   * German-language feeds are indexed with the English text-search configuration, so
   * German stemming is wrong — "Unternehmen" and "Unternehmens" are separate tokens.
   * Company names are unaffected, and matching "Migros" is what these are here for.
   * A German search configuration is worth doing and is not a reason to wait.
   */

  // ── European grocery and retail, including DACH ───────────────────────────
  {
    slug: 'esm-magazine',
    name: 'ESM — European Supermarket Magazine',
    officialDomain: 'www.esmmagazine.com',
    homepageUrl: 'https://www.esmmagazine.com/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'Madison Publications',
    language: 'en',
    geographySlugs: ['europe', 'germany', 'switzerland'],
    industrySlugs: ['retail', 'food-beverage', 'consumer-goods'],
    qualityScore: 70,
    notes:
      'European grocery trade press in English. Covers Coop, Lidl, Rewe and the Schwarz group directly — verified against the live feed before registering.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.esmmagazine.com/feed',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes: 'Publisher-operated feed, fetched 2026-09-04, 90 items. Excerpt only.',
    }),
  },
  {
    slug: 'retaildetail-eu',
    name: 'RetailDetail EU',
    officialDomain: 'www.retaildetail.eu',
    homepageUrl: 'https://www.retaildetail.eu/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'RetailDetail',
    language: 'en',
    geographySlugs: ['europe', 'germany'],
    industrySlugs: ['retail', 'food-beverage', 'fashion-apparel'],
    qualityScore: 66,
    notes: 'Benelux and continental European retail, in English.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.retaildetail.eu/feed/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes: 'Publisher-operated feed, fetched 2026-09-04, 30 items. Excerpt only.',
    }),
  },
  {
    slug: 'lebensmittel-zeitung',
    name: 'Lebensmittel Zeitung',
    officialDomain: 'www.lebensmittelzeitung.net',
    homepageUrl: 'https://www.lebensmittelzeitung.net/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'dfv Mediengruppe',
    language: 'de',
    geographySlugs: ['germany', 'europe'],
    industrySlugs: ['retail', 'food-beverage', 'consumer-goods'],
    qualityScore: 74,
    notes:
      'The German food-retail trade paper. The single best source for Edeka, Rewe, Aldi and the Schwarz group; verified covering all four before registering.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.lebensmittelzeitung.net/feed',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes: 'Publisher-operated feed, fetched 2026-09-04, 25 items. Excerpt only.',
    }),
  },

  // ── Switzerland ───────────────────────────────────────────────────────────
  {
    slug: 'srf-wirtschaft',
    name: 'SRF Wirtschaft',
    officialDomain: 'www.srf.ch',
    homepageUrl: 'https://www.srf.ch/news/wirtschaft',
    sourceType: 'independent_news',
    perspective: 'INDEPENDENT_BUSINESS_MEDIA',
    sourceOwner: 'Schweizer Radio und Fernsehen',
    language: 'de',
    geographySlugs: ['switzerland', 'europe'],
    industrySlugs: [],
    qualityScore: 80,
    notes:
      'Swiss public broadcaster, business desk. The first Swiss source in the registry — Migros and Coop were tracked companies with no publication that covers them.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.srf.ch/news/bnf/rss/1926',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes:
        'Public-service broadcaster feed, published openly for syndication. Fetched 2026-09-04, 60 items. Excerpt only, attributed and linked.',
    }),
  },

  // ── Germany, general business ─────────────────────────────────────────────
  {
    slug: 'tagesschau-wirtschaft',
    name: 'tagesschau — Wirtschaft',
    officialDomain: 'www.tagesschau.de',
    homepageUrl: 'https://www.tagesschau.de/wirtschaft',
    sourceType: 'independent_news',
    perspective: 'INDEPENDENT_BUSINESS_MEDIA',
    sourceOwner: 'ARD-aktuell',
    language: 'de',
    geographySlugs: ['germany', 'europe'],
    industrySlugs: [],
    qualityScore: 80,
    notes: 'German public broadcaster, business desk. Cross-economy, so it lends no sector.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.tagesschau.de/wirtschaft/index~rss2.xml',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes:
        'Public-service broadcaster feed, published openly. Fetched 2026-09-04, 19 items. Excerpt only.',
    }),
  },

  // ── Luxury, watches and jewellery ─────────────────────────────────────────
  {
    slug: 'wwd',
    name: 'WWD',
    officialDomain: 'wwd.com',
    homepageUrl: 'https://wwd.com/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'Penske Media Corporation',
    language: 'en',
    geographySlugs: ['global', 'united-states'],
    industrySlugs: ['luxury-goods', 'fashion-apparel', 'retail'],
    qualityScore: 72,
    notes: 'The fashion and luxury business paper of record. Covers LVMH, Kering and Richemont.',
    connector: {
      type: 'rss',
      endpoint: 'https://wwd.com/feed/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes: 'Publisher-operated feed, fetched 2026-09-04, 10 items. Excerpt only.',
    }),
  },
  {
    slug: 'luxury-society',
    name: 'Luxury Society',
    officialDomain: 'www.luxurysociety.com',
    homepageUrl: 'https://www.luxurysociety.com/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'Digital Luxury Group',
    language: 'en',
    geographySlugs: ['global', 'switzerland'],
    industrySlugs: ['luxury-goods'],
    qualityScore: 64,
    notes: 'Luxury industry analysis, Geneva-based.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.luxurysociety.com/en/rss',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes: 'Publisher-operated feed, fetched 2026-09-04, 10 items. Excerpt only.',
    }),
  },
  {
    slug: 'jewellery-editor',
    name: 'The Jewellery Editor',
    officialDomain: 'www.thejewelleryeditor.com',
    homepageUrl: 'https://www.thejewelleryeditor.com/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'The Jewellery Editor Ltd',
    language: 'en',
    geographySlugs: ['global', 'united-kingdom'],
    industrySlugs: ['luxury-goods'],
    qualityScore: 58,
    notes: 'Fine jewellery and watches, including the Geneva and Basel fair cycle.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.thejewelleryeditor.com/feed',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes: 'Publisher-operated feed, fetched 2026-09-04, 20 items. Excerpt only.',
    }),
  },
  {
    slug: 'monochrome-watches',
    name: 'Monochrome Watches',
    officialDomain: 'monochrome-watches.com',
    homepageUrl: 'https://monochrome-watches.com/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'Monochrome Watches',
    language: 'en',
    geographySlugs: ['switzerland', 'global'],
    industrySlugs: ['luxury-goods'],
    qualityScore: 56,
    notes:
      'Swiss watch industry coverage — Rolex, Patek Philippe and Audemars Piguet publish almost nothing themselves.',
    connector: {
      type: 'rss',
      endpoint: 'https://monochrome-watches.com/feed/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes: 'Publisher-operated feed, fetched 2026-09-04, 10 items. Excerpt only.',
    }),
  },
  {
    slug: 'luxus-plus',
    name: 'Luxus Plus',
    officialDomain: 'luxus-plus.com',
    homepageUrl: 'https://luxus-plus.com/en/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'Luxus Plus',
    language: 'en',
    geographySlugs: ['france', 'europe'],
    industrySlugs: ['luxury-goods'],
    qualityScore: 56,
    notes: 'French luxury business coverage in English. LVMH, Kering, Hermès.',
    connector: {
      type: 'rss',
      endpoint: 'https://luxus-plus.com/en/feed/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes: 'Publisher-operated feed, fetched 2026-09-04, 10 items. Excerpt only.',
    }),
  },

  /*
   * German-language subscription dailies. Feeds verified reachable 2026-09-04 and left
   * off for the same reason as the FT and the NZZ's English-language peers: reuse of
   * their headlines and summaries is a licence question, and this project does not guess
   * about rights.
   */
  {
    slug: 'nzz',
    name: 'Neue Zürcher Zeitung',
    officialDomain: 'www.nzz.ch',
    homepageUrl: 'https://www.nzz.ch/',
    sourceType: 'independent_news',
    perspective: 'LICENSED_PREMIUM',
    sourceOwner: 'NZZ Mediengruppe',
    language: 'de',
    geographySlugs: ['switzerland', 'europe'],
    industrySlugs: [],
    qualityScore: 86,
    notes: 'Feed reachable 2026-09-04 (15 items). Off pending a licence decision.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.nzz.ch/recent.rss',
      isActive: false,
      schedule: 'daily',
    },
    policy: pendingReview(
      'Swiss subscription daily. Feed verified reachable 2026-09-04; reuse of headlines and summaries requires a licence. Not ingested.',
    ),
  },
  {
    slug: 'handelsblatt',
    name: 'Handelsblatt',
    officialDomain: 'www.handelsblatt.com',
    homepageUrl: 'https://www.handelsblatt.com/',
    sourceType: 'independent_news',
    perspective: 'LICENSED_PREMIUM',
    sourceOwner: 'Handelsblatt Media Group',
    language: 'de',
    geographySlugs: ['germany', 'europe'],
    industrySlugs: [],
    qualityScore: 86,
    notes: 'Feed reachable 2026-09-04 (50 items). Off pending a licence decision.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.handelsblatt.com/contentexport/feed/schlagzeilen',
      isActive: false,
      schedule: 'daily',
    },
    policy: pendingReview(
      'German subscription business daily. Feed verified reachable 2026-09-04; reuse requires a licence. Not ingested.',
    ),
  },

  /*
   * ── Benelux and Nordic sources, added 2026-09-04 ──────────────────────────
   *
   * Belgian and Dutch grocery already arrives through RetailDetail and ESM — which is why
   * Colruyt and HEMA turned up in claims before either was a registered company. The
   * Nordics had nothing at all beyond H&M's own newsroom.
   *
   * Public broadcasters where possible: they publish across the whole economy, their
   * feeds are meant for syndication, and they are the least ambiguous rights position
   * available in a language nobody here reads fluently. All are registered against no
   * industry, because a national broadcaster is not about a sector.
   */

  {
    slug: 'nu-nl-economie',
    name: 'NU.nl — Economie',
    officialDomain: 'www.nu.nl',
    homepageUrl: 'https://www.nu.nl/economie',
    sourceType: 'independent_news',
    perspective: 'INDEPENDENT_BUSINESS_MEDIA',
    sourceOwner: 'DPG Media',
    language: 'nl',
    geographySlugs: ['netherlands', 'europe'],
    industrySlugs: [],
    qualityScore: 68,
    notes: 'Dutch general business news. Ahold Delhaize, Jumbo, Heineken, Philips, Adyen.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.nu.nl/rss/Economie',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes: 'Publisher-operated section feed, fetched 2026-09-04, 30 items. Excerpt only.',
    }),
  },
  {
    slug: 'dutchnews',
    name: 'DutchNews.nl',
    officialDomain: 'www.dutchnews.nl',
    homepageUrl: 'https://www.dutchnews.nl/',
    sourceType: 'independent_news',
    perspective: 'INDEPENDENT_BUSINESS_MEDIA',
    sourceOwner: 'DutchNews.nl',
    language: 'en',
    geographySlugs: ['netherlands'],
    industrySlugs: [],
    qualityScore: 62,
    notes: 'Dutch news in English — useful where the NU.nl feed is hard to read.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.dutchnews.nl/feed/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes: 'Publisher-operated feed, fetched 2026-09-04, 10 items. Excerpt only.',
    }),
  },
  {
    slug: 'dr-penge',
    name: 'DR — Penge',
    officialDomain: 'www.dr.dk',
    homepageUrl: 'https://www.dr.dk/nyheder/penge',
    sourceType: 'independent_news',
    perspective: 'INDEPENDENT_BUSINESS_MEDIA',
    sourceOwner: 'Danmarks Radio',
    language: 'da',
    geographySlugs: ['denmark', 'europe'],
    industrySlugs: [],
    qualityScore: 78,
    notes: 'Danish public broadcaster, money and business desk. Salling, Carlsberg, LEGO, Maersk.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.dr.dk/nyheder/service/feeds/penge',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes:
        'Public-service broadcaster feed, published for syndication. Fetched 2026-09-04, 20 items. Excerpt only.',
    }),
  },
  {
    slug: 'nrk-nyheter',
    name: 'NRK Nyheter',
    officialDomain: 'www.nrk.no',
    homepageUrl: 'https://www.nrk.no/',
    sourceType: 'independent_news',
    perspective: 'INDEPENDENT_BUSINESS_MEDIA',
    sourceOwner: 'Norsk rikskringkasting',
    language: 'no',
    geographySlugs: ['norway', 'europe'],
    industrySlugs: [],
    qualityScore: 76,
    notes: 'Norwegian public broadcaster. Reitan, Orkla, Equinor.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.nrk.no/toppsaker.rss',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes:
        'Public-service broadcaster feed. Fetched 2026-09-04, 100 items. Excerpt only, attributed and linked.',
    }),
  },
  {
    slug: 'yle-uutiset',
    name: 'Yle Uutiset',
    officialDomain: 'yle.fi',
    homepageUrl: 'https://yle.fi/uutiset',
    sourceType: 'independent_news',
    perspective: 'INDEPENDENT_BUSINESS_MEDIA',
    sourceOwner: 'Yleisradio Oy',
    language: 'fi',
    geographySlugs: ['finland', 'europe'],
    industrySlugs: [],
    qualityScore: 76,
    notes: 'Finnish public broadcaster. Kesko, Nokia, the S Group.',
    connector: {
      type: 'rss',
      endpoint: 'https://yle.fi/rss/uutiset/paauutiset',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes: 'Public-service broadcaster feed. Fetched 2026-09-04, 13 items. Excerpt only.',
    }),
  },
  {
    slug: 'the-local-sweden',
    name: 'The Local Sweden',
    officialDomain: 'www.thelocal.se',
    homepageUrl: 'https://www.thelocal.se/',
    sourceType: 'independent_news',
    perspective: 'INDEPENDENT_BUSINESS_MEDIA',
    sourceOwner: 'The Local Europe AB',
    language: 'en',
    geographySlugs: ['sweden', 'europe'],
    industrySlugs: [],
    qualityScore: 60,
    notes: 'Swedish news in English. IKEA, H&M, Ericsson.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.thelocal.se/feeds/rss.php',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes: 'Publisher-operated feed, fetched 2026-09-04, 20 items. Excerpt only.',
    }),
  },
  {
    slug: 'dagens-industri',
    name: 'Dagens industri',
    officialDomain: 'www.di.se',
    homepageUrl: 'https://www.di.se/',
    sourceType: 'independent_news',
    perspective: 'LICENSED_PREMIUM',
    sourceOwner: 'Bonnier News',
    language: 'sv',
    geographySlugs: ['sweden', 'europe'],
    industrySlugs: [],
    qualityScore: 82,
    notes: 'Feed reachable 2026-09-04 (20 items). Off pending a licence decision.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.di.se/rss',
      isActive: false,
      schedule: 'daily',
    },
    policy: pendingReview(
      'Swedish subscription business daily. Feed verified reachable 2026-09-04; reuse requires a licence. Not ingested.',
    ),
  },

  /*
   * ── Public sector, added 2026-09-08 ───────────────────────────────────────
   *
   * The last of eighteen markets with no source. Every large-institution feed refused a
   * request — OECD, IMF, the World Bank and the EU tender database all 403 or 404 — so
   * this is trade press covering government rather than governments publishing about
   * themselves, which is the same shape as every other sector here.
   */
  {
    slug: 'global-government-forum',
    name: 'Global Government Forum',
    officialDomain: 'www.globalgovernmentforum.com',
    homepageUrl: 'https://www.globalgovernmentforum.com/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'Pendle Media',
    language: 'en',
    geographySlugs: ['global'],
    industrySlugs: ['public-sector'],
    qualityScore: 62,
    notes: 'Civil service and public administration across governments.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.globalgovernmentforum.com/feed/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes: 'Publisher-operated feed, fetched 2026-09-08, 10 items. Excerpt only.',
    }),
  },
  {
    slug: 'publictechnology',
    name: 'PublicTechnology',
    officialDomain: 'www.publictechnology.net',
    homepageUrl: 'https://www.publictechnology.net/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'Dods Group',
    language: 'en',
    geographySlugs: ['united-kingdom'],
    industrySlugs: ['public-sector', 'technology-ai'],
    qualityScore: 60,
    notes: 'UK government technology and digital transformation.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.publictechnology.net/feed/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes: 'Publisher-operated feed, fetched 2026-09-08, 10 items. Excerpt only.',
    }),
  },
  {
    slug: 'route-fifty',
    name: 'Route Fifty',
    officialDomain: 'www.route-fifty.com',
    homepageUrl: 'https://www.route-fifty.com/',
    sourceType: 'industry_publication',
    perspective: 'INDUSTRY_MEDIA',
    sourceOwner: 'GovExec',
    language: 'en',
    geographySlugs: ['united-states'],
    industrySlugs: ['public-sector'],
    qualityScore: 62,
    notes: 'US state and local government — procurement, policy and services.',
    connector: {
      type: 'rss',
      endpoint: 'https://www.route-fifty.com/rss/all/',
      isActive: true,
      schedule: 'daily',
    },
    policy: approvedFeed({
      reviewNotes: 'Publisher-operated feed, fetched 2026-09-08, 24 items. Excerpt only.',
    }),
  },
];
