/**
 * Entity seed.
 *
 * Consulting firms are ordinary entities with `kind: 'consulting_firm'`. They get no
 * special table, no special ranking and no reserved place in the navigation — the
 * only thing that distinguishes them is a value in an enum, which is exactly the point
 * of the "Accenture is not the product foundation" requirement.
 *
 * `requiresContext` on an alias means the alias is an ordinary word or too short to
 * match safely on its own ("Next", "Meta", "EY", "H&M"). Those need a corroborating
 * signal before entity resolution accepts them.
 */

export interface EntitySeed {
  slug: string;
  kind: 'company' | 'consulting_firm' | 'person' | 'technology' | 'institution';
  name: string;
  legalName?: string;
  description: string;
  officialDomain: string;
  ticker?: string;
  hq?: string;
  primaryIndustrySlug?: string;
  industrySlugs?: string[];
  /** Fictional entity used only by demo fixtures. Badged everywhere it appears. */
  isDemo?: boolean;
  businessModelSlug?: string;
  aliases: { alias: string; type?: string; requiresContext?: boolean; language?: string }[];
}

export const ENTITIES: EntitySeed[] = [
  // ── Retail, fashion and consumer ──────────────────────────────────────────
  {
    slug: 'hm-group', kind: 'company', name: 'H&M Group', legalName: 'H & M Hennes & Mauritz AB',
    description: 'Swedish multinational clothing retailer operating a vertically integrated fast-fashion model across multiple brands.',
    officialDomain: 'hmgroup.com', ticker: 'HM-B', hq: 'sweden',
    primaryIndustrySlug: 'fashion-apparel', industrySlugs: ['fashion-apparel', 'retail'],
    businessModelSlug: 'fast-fashion',
    aliases: [
      { alias: 'H&M Group' }, { alias: 'H & M Hennes & Mauritz', type: 'legal' },
      { alias: 'Hennes & Mauritz', type: 'legal' }, { alias: 'H&M', requiresContext: true },
      { alias: 'HM-B', type: 'ticker', requiresContext: true },
    ],
  },
  {
    slug: 'inditex', kind: 'company', name: 'Inditex', legalName: 'Industria de Diseño Textil, S.A.',
    description: 'Spanish fashion group and owner of Zara, operating a short-lead-time vertically integrated model.',
    officialDomain: 'inditex.com', ticker: 'ITX', hq: 'spain',
    primaryIndustrySlug: 'fashion-apparel', industrySlugs: ['fashion-apparel', 'retail'],
    businessModelSlug: 'fast-fashion',
    aliases: [
      { alias: 'Inditex' }, { alias: 'Industria de Diseño Textil', type: 'legal', language: 'es' },
      { alias: 'Zara', type: 'trade' }, { alias: 'ITX', type: 'ticker', requiresContext: true },
    ],
  },
  {
    slug: 'zalando', kind: 'company', name: 'Zalando', legalName: 'Zalando SE',
    description: 'European online fashion platform combining retail and a partner marketplace.',
    officialDomain: 'zalando.com', ticker: 'ZAL', hq: 'germany',
    primaryIndustrySlug: 'fashion-apparel', industrySlugs: ['fashion-apparel', 'retail'],
    businessModelSlug: 'marketplace',
    aliases: [{ alias: 'Zalando' }, { alias: 'Zalando SE', type: 'legal' }, { alias: 'ZAL', type: 'ticker', requiresContext: true }],
  },
  {
    slug: 'c-and-a', kind: 'company', name: 'C&A', legalName: 'C&A Mode GmbH & Co. KG',
    description: 'European clothing retail chain operating across continental Europe.',
    officialDomain: 'c-and-a.com', hq: 'germany',
    primaryIndustrySlug: 'fashion-apparel', industrySlugs: ['fashion-apparel', 'retail'],
    aliases: [{ alias: 'C&A', requiresContext: true }, { alias: 'C and A', requiresContext: true }, { alias: 'C&A Mode', type: 'legal' }],
  },
  {
    slug: 'nike', kind: 'company', name: 'Nike', legalName: 'NIKE, Inc.',
    description: 'American athletic footwear and apparel brand with a direct-to-consumer led distribution strategy.',
    officialDomain: 'nike.com', ticker: 'NKE', hq: 'united-states',
    primaryIndustrySlug: 'fashion-apparel', industrySlugs: ['fashion-apparel', 'consumer-goods'],
    businessModelSlug: 'premium-brand',
    aliases: [{ alias: 'Nike', requiresContext: true }, { alias: 'NIKE Inc', type: 'legal' }, { alias: 'NKE', type: 'ticker', requiresContext: true }],
  },
  {
    slug: 'adidas', kind: 'company', name: 'adidas', legalName: 'adidas AG',
    description: 'German sportswear manufacturer and brand.',
    officialDomain: 'adidas-group.com', ticker: 'ADS', hq: 'germany',
    primaryIndustrySlug: 'fashion-apparel', industrySlugs: ['fashion-apparel', 'consumer-goods'],
    businessModelSlug: 'premium-brand',
    aliases: [{ alias: 'adidas' }, { alias: 'adidas AG', type: 'legal' }, { alias: 'ADS', type: 'ticker', requiresContext: true }],
  },
  {
    slug: 'uniqlo', kind: 'company', name: 'Uniqlo', legalName: 'Fast Retailing Co., Ltd.',
    description: 'Japanese apparel retailer, principal brand of Fast Retailing, built on a core-range LifeWear model.',
    officialDomain: 'fastretailing.com', ticker: '9983', hq: 'japan',
    primaryIndustrySlug: 'fashion-apparel', industrySlugs: ['fashion-apparel', 'retail'],
    businessModelSlug: 'vertical-retail',
    aliases: [{ alias: 'Uniqlo' }, { alias: 'Fast Retailing', type: 'legal' }, { alias: 'UNIQLO' }],
  },
  {
    slug: 'shein', kind: 'company', name: 'Shein',
    description: 'Digital-first apparel company operating an on-demand micro-batch production model.',
    officialDomain: 'shein.com', hq: 'china',
    primaryIndustrySlug: 'fashion-apparel', industrySlugs: ['fashion-apparel', 'retail'],
    businessModelSlug: 'ultra-fast-digital',
    aliases: [{ alias: 'Shein', requiresContext: true }, { alias: 'SHEIN', requiresContext: true }],
  },
  {
    slug: 'walmart', kind: 'company', name: 'Walmart', legalName: 'Walmart Inc.',
    description: 'American multinational retail corporation operating hypermarkets, discount stores and a growing marketplace and retail media business.',
    officialDomain: 'corporate.walmart.com', ticker: 'WMT', hq: 'united-states',
    primaryIndustrySlug: 'retail', industrySlugs: ['retail', 'consumer-goods'],
    businessModelSlug: 'multi-brand-retail',
    aliases: [{ alias: 'Walmart' }, { alias: 'Walmart Inc', type: 'legal' }, { alias: 'WMT', type: 'ticker', requiresContext: true }, { alias: 'Walmart Connect', type: 'trade' }],
  },
  {
    slug: 'amazon', kind: 'company', name: 'Amazon', legalName: 'Amazon.com, Inc.',
    description: 'American technology and retail company operating a marketplace, cloud infrastructure (AWS), advertising and logistics network.',
    officialDomain: 'aboutamazon.com', ticker: 'AMZN', hq: 'united-states',
    primaryIndustrySlug: 'retail', industrySlugs: ['retail', 'technology-ai'],
    businessModelSlug: 'marketplace',
    aliases: [{ alias: 'Amazon', requiresContext: true }, { alias: 'Amazon.com', type: 'legal' }, { alias: 'AWS', type: 'abbreviation' }, { alias: 'Amazon Web Services', type: 'trade' }, { alias: 'AMZN', type: 'ticker', requiresContext: true }],
  },

  // ── Technology ────────────────────────────────────────────────────────────
  {
    slug: 'openai', kind: 'company', name: 'OpenAI', legalName: 'OpenAI, Inc.',
    description: 'AI research and deployment company developing the GPT family of foundation models.',
    officialDomain: 'openai.com', hq: 'united-states',
    primaryIndustrySlug: 'technology-ai', industrySlugs: ['technology-ai'],
    businessModelSlug: 'model-provider',
    aliases: [{ alias: 'OpenAI' }, { alias: 'Open AI' }, { alias: 'ChatGPT', type: 'trade' }],
  },
  {
    slug: 'anthropic', kind: 'company', name: 'Anthropic', legalName: 'Anthropic PBC',
    description: 'AI safety and research company developing the Claude family of foundation models.',
    officialDomain: 'anthropic.com', hq: 'united-states',
    primaryIndustrySlug: 'technology-ai', industrySlugs: ['technology-ai'],
    businessModelSlug: 'model-provider',
    aliases: [{ alias: 'Anthropic' }, { alias: 'Claude', type: 'trade', requiresContext: true }],
  },
  {
    slug: 'nvidia', kind: 'company', name: 'NVIDIA', legalName: 'NVIDIA Corporation',
    description: 'Designer of GPUs and accelerated computing platforms underpinning most AI training and inference.',
    officialDomain: 'nvidia.com', ticker: 'NVDA', hq: 'united-states',
    primaryIndustrySlug: 'technology-ai', industrySlugs: ['technology-ai'],
    businessModelSlug: 'accelerated-compute',
    aliases: [{ alias: 'NVIDIA' }, { alias: 'Nvidia' }, { alias: 'NVDA', type: 'ticker', requiresContext: true }],
  },
  {
    slug: 'microsoft', kind: 'company', name: 'Microsoft', legalName: 'Microsoft Corporation',
    description: 'Software and cloud company operating Azure, Microsoft 365 and a portfolio of AI products.',
    officialDomain: 'microsoft.com', ticker: 'MSFT', hq: 'united-states',
    primaryIndustrySlug: 'technology-ai', industrySlugs: ['technology-ai'],
    businessModelSlug: 'hyperscaler',
    aliases: [{ alias: 'Microsoft' }, { alias: 'Azure', type: 'trade' }, { alias: 'MSFT', type: 'ticker', requiresContext: true }, { alias: 'Microsoft Copilot', type: 'trade' }],
  },
  {
    slug: 'google', kind: 'company', name: 'Google', legalName: 'Alphabet Inc.',
    description: 'Technology company operating search, advertising, Google Cloud and the Gemini model family.',
    officialDomain: 'blog.google', ticker: 'GOOGL', hq: 'united-states',
    primaryIndustrySlug: 'technology-ai', industrySlugs: ['technology-ai'],
    businessModelSlug: 'hyperscaler',
    aliases: [{ alias: 'Google' }, { alias: 'Alphabet', type: 'legal', requiresContext: true }, { alias: 'Google Cloud', type: 'trade' }, { alias: 'Gemini', type: 'trade', requiresContext: true }, { alias: 'DeepMind', type: 'trade' }],
  },
  {
    slug: 'meta', kind: 'company', name: 'Meta', legalName: 'Meta Platforms, Inc.',
    description: 'Technology company operating social platforms and developing the Llama open-weight model family.',
    officialDomain: 'about.fb.com', ticker: 'META', hq: 'united-states',
    primaryIndustrySlug: 'technology-ai', industrySlugs: ['technology-ai'],
    aliases: [{ alias: 'Meta', requiresContext: true }, { alias: 'Meta Platforms', type: 'legal' }, { alias: 'Facebook', type: 'former' }, { alias: 'Llama', type: 'trade', requiresContext: true }],
  },
  {
    slug: 'palantir', kind: 'company', name: 'Palantir', legalName: 'Palantir Technologies Inc.',
    description: 'Enterprise data and decision platform vendor working with commercial and government customers.',
    officialDomain: 'palantir.com', ticker: 'PLTR', hq: 'united-states',
    primaryIndustrySlug: 'technology-ai', industrySlugs: ['technology-ai'],
    businessModelSlug: 'enterprise-saas',
    aliases: [{ alias: 'Palantir' }, { alias: 'Palantir Technologies', type: 'legal' }, { alias: 'Foundry', type: 'trade', requiresContext: true }, { alias: 'PLTR', type: 'ticker', requiresContext: true }],
  },

  // ── Consulting and professional services ──────────────────────────────────
  // Ordinary entities. Monitored, ranked and filtered by the same mechanisms as
  // every other company.
  {
    slug: 'accenture', kind: 'consulting_firm', name: 'Accenture', legalName: 'Accenture plc',
    description: 'Global professional services company providing strategy, consulting, technology and operations services.',
    officialDomain: 'accenture.com', ticker: 'ACN', hq: 'global',
    industrySlugs: ['technology-ai'],
    aliases: [{ alias: 'Accenture' }, { alias: 'Accenture plc', type: 'legal' }, { alias: 'ACN', type: 'ticker', requiresContext: true }, { alias: 'Accenture Song', type: 'trade' }],
  },
  { slug: 'mckinsey', kind: 'consulting_firm', name: 'McKinsey & Company', description: 'Global management consulting firm.', officialDomain: 'mckinsey.com', hq: 'global', aliases: [{ alias: 'McKinsey' }, { alias: 'McKinsey & Company', type: 'legal' }, { alias: 'QuantumBlack', type: 'trade' }] },
  { slug: 'bcg', kind: 'consulting_firm', name: 'Boston Consulting Group', description: 'Global management consulting firm.', officialDomain: 'bcg.com', hq: 'global', aliases: [{ alias: 'BCG' }, { alias: 'Boston Consulting Group', type: 'legal' }, { alias: 'BCG X', type: 'trade' }] },
  { slug: 'bain', kind: 'consulting_firm', name: 'Bain & Company', description: 'Global management consulting firm.', officialDomain: 'bain.com', hq: 'global', aliases: [{ alias: 'Bain & Company' }, { alias: 'Bain', requiresContext: true }] },
  { slug: 'deloitte', kind: 'consulting_firm', name: 'Deloitte', description: 'Global professional services network.', officialDomain: 'deloitte.com', hq: 'global', aliases: [{ alias: 'Deloitte' }, { alias: 'Deloitte Touche Tohmatsu', type: 'legal' }] },
  { slug: 'pwc', kind: 'consulting_firm', name: 'PwC', description: 'Global professional services network.', officialDomain: 'pwc.com', hq: 'global', aliases: [{ alias: 'PwC', requiresContext: true }, { alias: 'PricewaterhouseCoopers', type: 'legal' }] },
  { slug: 'ey', kind: 'consulting_firm', name: 'EY', description: 'Global professional services network.', officialDomain: 'ey.com', hq: 'global', aliases: [{ alias: 'EY', requiresContext: true }, { alias: 'Ernst & Young', type: 'legal' }] },
  { slug: 'kpmg', kind: 'consulting_firm', name: 'KPMG', description: 'Global professional services network.', officialDomain: 'kpmg.com', hq: 'global', aliases: [{ alias: 'KPMG' }] },
  { slug: 'capgemini', kind: 'consulting_firm', name: 'Capgemini', description: 'Global technology and consulting services company.', officialDomain: 'capgemini.com', hq: 'global', aliases: [{ alias: 'Capgemini' }, { alias: 'Capgemini Invent', type: 'trade' }] },
  { slug: 'ibm-consulting', kind: 'consulting_firm', name: 'IBM Consulting', description: 'Consulting arm of IBM.', officialDomain: 'ibm.com', hq: 'global', aliases: [{ alias: 'IBM Consulting' }, { alias: 'IBM', requiresContext: true }] },
  { slug: 'tcs', kind: 'consulting_firm', name: 'Tata Consultancy Services', description: 'Indian multinational IT services and consulting company.', officialDomain: 'tcs.com', hq: 'global', aliases: [{ alias: 'TCS', requiresContext: true }, { alias: 'Tata Consultancy Services', type: 'legal' }] },
  { slug: 'infosys', kind: 'consulting_firm', name: 'Infosys', description: 'Indian multinational IT services and consulting company.', officialDomain: 'infosys.com', hq: 'global', aliases: [{ alias: 'Infosys' }] },
  { slug: 'cognizant', kind: 'consulting_firm', name: 'Cognizant', description: 'American multinational IT services and consulting company.', officialDomain: 'cognizant.com', hq: 'global', aliases: [{ alias: 'Cognizant' }] },

  // ── Demo entities ─────────────────────────────────────────────────────────
  // Fictional companies used by the demo fixtures. They exist so the fixtures can
  // exercise entity resolution, cross-source clustering and contradiction detection.
  // Marked `isDemo`, and every derived item is badged accordingly in the UI.
  {
    slug: 'northwind-apparel', kind: 'company', name: 'Northwind Apparel', isDemo: true,
    description: 'Fictional fashion retailer used in demo fixtures. Not a real company.',
    officialDomain: 'demo.local', hq: 'europe',
    primaryIndustrySlug: 'fashion-apparel', industrySlugs: ['fashion-apparel', 'retail'],
    aliases: [{ alias: 'Northwind Apparel' }, { alias: 'Northwind', requiresContext: true }],
  },
  {
    slug: 'meridian-retail-group', kind: 'company', name: 'Meridian Retail Group', isDemo: true,
    description: 'Fictional grocery and general merchandise retailer used in demo fixtures. Not a real company.',
    officialDomain: 'demo.local', hq: 'europe',
    primaryIndustrySlug: 'retail', industrySlugs: ['retail'],
    aliases: [{ alias: 'Meridian Retail Group' }, { alias: 'Meridian', requiresContext: true }],
  },
  {
    slug: 'halden-ai', kind: 'company', name: 'Halden AI', isDemo: true,
    description: 'Fictional demand forecasting vendor used in demo fixtures. Not a real company.',
    officialDomain: 'demo.local', hq: 'europe',
    primaryIndustrySlug: 'technology-ai', industrySlugs: ['technology-ai'],
    aliases: [{ alias: 'Halden AI' }, { alias: 'Halden', requiresContext: true }],
  },
  {
    slug: 'calder-stores', kind: 'company', name: 'Calder Stores', isDemo: true,
    description: 'Fictional retail chain used in demo fixtures. Not a real company.',
    officialDomain: 'demo.local', hq: 'europe',
    primaryIndustrySlug: 'retail', industrySlugs: ['retail'],
    aliases: [{ alias: 'Calder Stores' }, { alias: 'Calder', requiresContext: true }],
  },

  // ── Institutions ──────────────────────────────────────────────────────────
  { slug: 'european-commission', kind: 'institution', name: 'European Commission', description: 'Executive branch of the European Union; originator of most EU regulation affecting these industries.', officialDomain: 'ec.europa.eu', hq: 'europe', aliases: [{ alias: 'European Commission' }, { alias: 'EU Commission' }] },
  { slug: 'nist', kind: 'institution', name: 'NIST', legalName: 'National Institute of Standards and Technology', description: 'US standards body; publisher of the AI Risk Management Framework.', officialDomain: 'nist.gov', hq: 'united-states', aliases: [{ alias: 'NIST' }, { alias: 'National Institute of Standards and Technology', type: 'legal' }] },
];
