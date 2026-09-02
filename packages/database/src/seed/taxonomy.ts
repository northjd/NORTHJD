/**
 * Market model seed — the Depth layer.
 *
 * This is reference content, not demo data: it describes how these industries work,
 * and it is what turns "H&M announced X" into "H&M announced X, which touches
 * allocation and replenishment, where full-price sell-through is the value driver".
 *
 * Each industry carries a `lastReviewedAt` so the UI can show how current the model
 * is, and `sourceRefs` pointing at public material a reader can check.
 */

export interface IndustrySeed {
  slug: string;
  name: string;
  parentSlug?: string;
  definition: string;
  marketStructure: string;
  regulatoryEnvironment: string;
  transformationAgenda: string;
  openQuestions: string[];
  sourceRefs: { label: string; url: string }[];
  valueChainStages: { slug: string; name: string; description: string; profitPoolNote: string }[];
  kpis: {
    slug: string;
    name: string;
    definition: string;
    formula: string;
    whyItMatters: string;
    parentSlug?: string;
    valueLever?: string;
    typicalRange?: string;
  }[];
  businessModels: { slug: string; name: string; description: string; economics: string; examples: string[] }[];
  capabilities: { slug: string; name: string; description: string; stageSlug?: string; dimensions: string[] }[];
}

export const INDUSTRIES: IndustrySeed[] = [
  {
    slug: 'retail',
    name: 'Retail',
    definition:
      'Businesses that sell goods to end consumers through stores, digital channels or both. Retail is a working-capital and gross-margin business: it buys, holds and sells inventory, and most of its strategic problems reduce to having the right product in the right place at the right price.',
    marketStructure:
      'Highly fragmented at the long tail and increasingly concentrated at the top, with scale advantages in sourcing, logistics and data. Grocery and general merchandise are dominated by a handful of national players per market; specialty retail is more contestable. Marketplaces have shifted a growing share of the profit pool from the retailer to the platform, and retail media has emerged as a high-margin adjacency that funds price investment.',
    regulatoryEnvironment:
      'Consumer protection and pricing transparency rules, product safety and labelling, extended producer responsibility for packaging, data protection (GDPR in the EU), and — in the EU — the Digital Services Act and Digital Markets Act for platform-adjacent operations. Sustainability reporting (CSRD) now reaches supply chains.',
    transformationAgenda:
      'Unified commerce across channels; demand forecasting and allocation with machine learning; store-as-fulfilment; retail media build-out; supply chain resilience and nearshoring; store labour productivity; assortment rationalisation. Most large retailers are simultaneously modernising a planning stack designed for a single-channel world.',
    openQuestions: [
      'Where does retail media plateau, and what happens to price investment when it does?',
      'Does AI-driven allocation deliver margin, or does it get absorbed into deeper promotions?',
      'How much of the store network survives as fulfilment infrastructure rather than as selling space?',
    ],
    sourceRefs: [
      { label: 'Eurostat retail trade statistics', url: 'https://ec.europa.eu/eurostat/web/short-term-business-statistics' },
      { label: 'US Census Bureau retail sales', url: 'https://www.census.gov/retail/' },
    ],
    valueChainStages: [
      { slug: 'retail-assortment-planning', name: 'Assortment & range planning', description: 'Deciding what to sell, at what breadth and depth, per channel and cluster.', profitPoolNote: 'Sets the ceiling on everything downstream; errors here cannot be fixed by execution.' },
      { slug: 'retail-sourcing', name: 'Sourcing & buying', description: 'Supplier selection, negotiation, cost prices, order commitments.', profitPoolNote: 'Largest single lever on gross margin; also where lead-time risk is created.' },
      { slug: 'retail-supply-chain', name: 'Supply chain & logistics', description: 'Inbound freight, distribution centres, transport, last mile.', profitPoolNote: 'Mostly a cost pool; last-mile economics decide whether digital orders are profitable.' },
      { slug: 'retail-allocation', name: 'Allocation & replenishment', description: 'Distributing inventory across stores, channels and time.', profitPoolNote: 'Where forecasting quality converts into full-price sales or markdown.' },
      { slug: 'retail-pricing', name: 'Pricing & promotion', description: 'Price architecture, markdown cadence, promotional calendar.', profitPoolNote: 'Fastest lever on margin and the easiest to destroy value with.' },
      { slug: 'retail-store-ops', name: 'Store operations', description: 'Labour scheduling, availability, shrink, in-store service.', profitPoolNote: 'Largest controllable operating cost after occupancy.' },
      { slug: 'retail-ecommerce', name: 'Digital & marketplace', description: 'Owned digital channels, third-party marketplaces, retail media.', profitPoolNote: 'Retail media is high margin; marketplace commissions transfer margin away from the retailer.' },
      { slug: 'retail-customer', name: 'Customer & loyalty', description: 'Acquisition, retention, personalisation, loyalty programmes.', profitPoolNote: 'Drives repeat rate and the first-party data that retail media monetises.' },
    ],
    kpis: [
      { slug: 'gross-margin', name: 'Gross margin', definition: 'Revenue less cost of goods sold, as a percentage of revenue.', formula: '(Revenue − COGS) / Revenue', whyItMatters: 'The headline measure of buying quality and pricing discipline. Almost every retail initiative is ultimately argued in gross-margin points.', valueLever: 'margin_improvement', typicalRange: '25–55% depending on format' },
      { slug: 'full-price-sell-through', name: 'Full-price sell-through', definition: 'Share of units sold before any markdown.', formula: 'Units sold at full price / Units received', whyItMatters: 'Separates genuine demand from demand bought with discount. The single best test of whether planning and allocation are working.', parentSlug: 'gross-margin', valueLever: 'margin_improvement', typicalRange: '50–80% in fashion; higher in replenishment categories' },
      { slug: 'markdown-rate', name: 'Markdown rate', definition: 'Value of price reductions as a share of full-price sales value.', formula: 'Markdown value / Gross sales value', whyItMatters: 'The cost of getting the forecast wrong. Rising markdown with flat sell-through means the assortment, not the pricing, is the problem.', parentSlug: 'gross-margin', valueLever: 'margin_improvement' },
      { slug: 'inventory-turn', name: 'Inventory turnover', definition: 'How many times inventory is sold and replaced in a period.', formula: 'COGS / Average inventory at cost', whyItMatters: 'Ties gross margin to working capital. Two retailers with the same margin and different turns are not equally profitable.', valueLever: 'working_capital', typicalRange: '3–6x for apparel; 10x+ for grocery' },
      { slug: 'availability', name: 'On-shelf availability', definition: 'Share of demand met from stock at the point of sale.', formula: 'In-stock SKU-store combinations / Total expected', whyItMatters: 'Lost sales are invisible in the P&L, which is why availability is chronically under-managed.', parentSlug: 'inventory-turn', valueLever: 'revenue_growth', typicalRange: '92–98%' },
      { slug: 'gmroi', name: 'GMROI', definition: 'Gross margin return on inventory investment.', formula: 'Gross margin / Average inventory at cost', whyItMatters: 'The measure that stops teams optimising margin and turn against each other.', valueLever: 'margin_improvement' },
      { slug: 'like-for-like', name: 'Like-for-like sales growth', definition: 'Sales growth excluding new and closed space.', formula: '(Comparable sales this period / Comparable sales prior) − 1', whyItMatters: 'Strips out the growth that came from opening stores. The market reads this number before any other.', valueLever: 'revenue_growth' },
      { slug: 'cost-to-serve', name: 'Cost to serve', definition: 'Fully loaded cost of fulfilling an order by channel.', formula: 'Total fulfilment cost / Orders', whyItMatters: 'Decides whether digital growth is profitable growth. Frequently unknown at order level.', valueLever: 'cost_reduction' },
    ],
    businessModels: [
      { slug: 'vertical-retail', name: 'Vertically integrated retail', description: 'Owns design, sourcing and retail; sells almost exclusively own brand.', economics: 'Higher gross margin, higher inventory risk, sourcing capability is the moat.', examples: ['Inditex', 'H&M', 'Uniqlo'] },
      { slug: 'multi-brand-retail', name: 'Multi-brand retail', description: 'Buys and resells third-party brands.', economics: 'Lower gross margin, lower design risk, differentiation rests on assortment and experience.', examples: ['Zalando', 'Walmart'] },
      { slug: 'marketplace', name: 'Marketplace', description: 'Provides the platform; third parties hold inventory and sell.', economics: 'Commission revenue with negligible inventory risk; scales on take rate and traffic.', examples: ['Amazon', 'Zalando Partner Program'] },
      { slug: 'retail-media', name: 'Retail media network', description: 'Sells advertising against first-party shopper data and owned surfaces.', economics: 'Very high incremental margin; funds price competitiveness elsewhere in the P&L.', examples: ['Amazon Ads', 'Walmart Connect'] },
    ],
    capabilities: [
      { slug: 'demand-forecasting', name: 'Demand forecasting', description: 'Predicting unit demand by SKU, location and week.', stageSlug: 'retail-allocation', dimensions: ['data', 'technology', 'process'] },
      { slug: 'assortment-optimisation', name: 'Assortment optimisation', description: 'Choosing range breadth and depth per cluster against a financial plan.', stageSlug: 'retail-assortment-planning', dimensions: ['process', 'decision_rights', 'data'] },
      { slug: 'dynamic-pricing', name: 'Price and markdown optimisation', description: 'Setting and re-setting prices against demand, stock and competition.', stageSlug: 'retail-pricing', dimensions: ['technology', 'governance', 'decision_rights'] },
      { slug: 'inventory-allocation', name: 'Inventory allocation', description: 'Placing units where they will sell at full price.', stageSlug: 'retail-allocation', dimensions: ['data', 'process'] },
      { slug: 'workforce-scheduling', name: 'Workforce scheduling', description: 'Matching store labour to traffic and task demand.', stageSlug: 'retail-store-ops', dimensions: ['process', 'talent', 'technology'] },
      { slug: 'personalisation', name: 'Customer personalisation', description: 'Tailoring offer, content and communication to the individual.', stageSlug: 'retail-customer', dimensions: ['data', 'technology', 'change_adoption'] },
    ],
  },

  {
    slug: 'fashion-apparel',
    name: 'Fashion & Apparel',
    parentSlug: 'retail',
    definition:
      'Design, production and sale of clothing, footwear and accessories. Distinguished from general retail by short product life cycles, high style risk and long sourcing lead times — the combination that makes fashion an inventory-timing problem more than a selling problem.',
    marketStructure:
      'A barbell: vertically integrated fast fashion and ultra-fast digital players at one end, luxury houses with pricing power at the other, and a squeezed mid-market between them. Manufacturing is concentrated in Asia with lead times of 8–40 weeks, which is why nearshoring recurs as a strategic theme. Resale and rental are growing but remain small relative to primary sales.',
    regulatoryEnvironment:
      'EU Strategy for Sustainable and Circular Textiles, Ecodesign for Sustainable Products Regulation and the Digital Product Passport; extended producer responsibility schemes; supply chain due diligence (German LkSG, EU CSDDD); green-claims rules restricting unsubstantiated sustainability marketing. Compliance is moving from reporting to product design.',
    transformationAgenda:
      'Shortening the design-to-shelf cycle; demand-driven buying against pre-season commitments; markdown reduction through better allocation; supply chain traceability for the Digital Product Passport; resale and take-back economics; AI in design, merchandising and content production.',
    openQuestions: [
      'Does ultra-fast fashion economics survive regulation on textile waste and import de minimis rules?',
      'Can traceability be delivered at product level without a step change in supplier data quality?',
      'Is AI shortening the design-to-shelf cycle in practice, or only the content production part of it?',
    ],
    sourceRefs: [
      { label: 'EU Strategy for Sustainable and Circular Textiles', url: 'https://environment.ec.europa.eu/strategy/textiles-strategy_en' },
      { label: 'Ecodesign for Sustainable Products Regulation', url: 'https://commission.europa.eu/energy-climate-change-environment/standards-tools-and-labels/products-labelling-rules-and-requirements/ecodesign-sustainable-products-regulation_en' },
    ],
    valueChainStages: [
      { slug: 'fashion-design', name: 'Design & product development', description: 'Trend interpretation, line building, sampling.', profitPoolNote: 'Determines style risk. Cheap to change here, ruinous to change later.' },
      { slug: 'fashion-merchandising', name: 'Merchandising & buying', description: 'Translating the range plan into an open-to-buy and committed orders.', profitPoolNote: 'The commitment point: capital is locked here months before demand is known.' },
      { slug: 'fashion-sourcing', name: 'Sourcing & manufacturing', description: 'Supplier selection, capacity booking, production, quality.', profitPoolNote: 'Cost price and lead time are set here; lead time is the constraint on responsiveness.' },
      { slug: 'fashion-distribution', name: 'Distribution', description: 'Inbound logistics, distribution centres, market allocation.', profitPoolNote: 'Cost pool; speed here partially compensates for long production lead times.' },
      { slug: 'fashion-retail-sales', name: 'Retail & digital sales', description: 'Own stores, wholesale, own digital, marketplaces.', profitPoolNote: 'Channel mix determines realised margin more than list price does.' },
      { slug: 'fashion-circularity', name: 'Resale, repair & recycling', description: 'Take-back, resale, repair and material recovery.', profitPoolNote: 'Currently a cost of compliance for most; a margin pool for very few.' },
    ],
    kpis: [
      { slug: 'sell-through-rate', name: 'Sell-through rate', definition: 'Share of a buy sold within the season.', formula: 'Units sold / Units bought', whyItMatters: 'The verdict on the buy. Below plan means either the product or the quantity was wrong, and the two need different fixes.', valueLever: 'margin_improvement', typicalRange: '70–90% by season end' },
      { slug: 'open-to-buy', name: 'Open-to-buy', definition: 'Budget remaining for future purchases within a plan period.', formula: 'Planned closing stock + planned sales − stock on hand − on order', whyItMatters: 'The financial control that stops merchandising over-committing. Where planning discipline is actually enforced.', valueLever: 'working_capital' },
      { slug: 'design-to-shelf', name: 'Design-to-shelf lead time', definition: 'Elapsed time from design freeze to product on sale.', formula: 'Days from design sign-off to first sale', whyItMatters: 'Every week removed is a week closer to real demand and a smaller pre-season bet.', valueLever: 'speed_to_market', typicalRange: '3 weeks (ultra-fast) to 12 months (traditional)' },
      { slug: 'stock-cover', name: 'Weeks of cover', definition: 'Weeks of forward demand held as inventory.', formula: 'Stock on hand / Average weekly sales', whyItMatters: 'The early warning on a markdown problem, visible weeks before the margin damage lands.', parentSlug: 'stock-cover', valueLever: 'inventory_reduction' },
      { slug: 'return-rate', name: 'Return rate', definition: 'Share of shipped units returned.', formula: 'Units returned / Units shipped', whyItMatters: 'In digital fashion, returns decide whether an order was profitable. Fit and content quality drive it more than policy does.', valueLever: 'cost_reduction', typicalRange: '20–50% for online apparel in Europe' },
    ],
    businessModels: [
      { slug: 'fast-fashion', name: 'Fast fashion', description: 'Short cycles, high newness, in-season reaction.', economics: 'Trades cost price for lead time; wins by mis-buying less rather than by buying cheaper.', examples: ['Zara', 'H&M'] },
      { slug: 'ultra-fast-digital', name: 'Ultra-fast digital', description: 'On-demand micro-batch production driven by live demand signals.', economics: 'Very low inventory risk, very high SKU count, dependent on logistics and import treatment.', examples: ['Shein'] },
      { slug: 'premium-brand', name: 'Premium & luxury brand', description: 'Brand equity supports price and limits markdown.', economics: 'High gross margin, deliberate scarcity, distribution control is the moat.', examples: ['Nike', 'luxury houses'] },
    ],
    capabilities: [
      { slug: 'merchandise-planning', name: 'Merchandise planning', description: 'Financial and unit planning across season, category and channel.', stageSlug: 'fashion-merchandising', dimensions: ['process', 'decision_rights', 'performance_management'] },
      { slug: 'in-season-reaction', name: 'In-season reaction', description: 'Repeat orders and reallocation against live sell-through.', stageSlug: 'fashion-merchandising', dimensions: ['process', 'data', 'governance'] },
      { slug: 'supply-traceability', name: 'Supply chain traceability', description: 'Component and tier-N supplier visibility for compliance and claims.', stageSlug: 'fashion-sourcing', dimensions: ['data', 'governance', 'technology'] },
      { slug: 'size-fit-optimisation', name: 'Size and fit optimisation', description: 'Reducing returns through better size curves and fit guidance.', stageSlug: 'fashion-retail-sales', dimensions: ['data', 'technology'] },
    ],
  },

  {
    slug: 'consumer-goods',
    name: 'Consumer Goods',
    definition:
      'Manufacturers of branded products sold through retail and direct channels. The economics are the mirror image of retail: gross margin is created in brand and formulation, and defended through trade terms, distribution and marketing efficiency.',
    marketStructure:
      'Concentrated in most categories, with a handful of multinationals facing private label from below and challenger brands from the side. Retailer buying power is the structural constraint; trade spend is often the second-largest line in the P&L after cost of goods and is chronically under-measured.',
    regulatoryEnvironment:
      'Product safety and labelling, health claims regulation, packaging and extended producer responsibility, deforestation-free supply chain rules (EUDR), and sustainability reporting under CSRD. Marketing to children and nutritional labelling are tightening in several markets.',
    transformationAgenda:
      'Revenue growth management and trade spend effectiveness; direct-to-consumer as a data channel rather than a revenue channel; demand sensing; portfolio rationalisation; packaging redesign for EPR costs; AI in marketing content production and in demand planning.',
    openQuestions: [
      'Does direct-to-consumer ever pay for itself, or is it a data acquisition cost?',
      'How much trade spend is genuinely incremental? Most companies cannot answer this at customer level.',
      'What does EPR pricing do to packaging-heavy categories?',
    ],
    sourceRefs: [{ label: 'EU packaging and packaging waste rules', url: 'https://environment.ec.europa.eu/topics/waste-and-recycling/packaging-waste_en' }],
    valueChainStages: [
      { slug: 'cg-rnd', name: 'R&D & formulation', description: 'Product development, reformulation, packaging design.', profitPoolNote: 'Creates the differentiation that supports price.' },
      { slug: 'cg-procurement', name: 'Procurement', description: 'Raw and packaging material sourcing.', profitPoolNote: 'Largest cost pool; commodity exposure drives margin volatility.' },
      { slug: 'cg-manufacturing', name: 'Manufacturing', description: 'Production, packing, quality.', profitPoolNote: 'Asset utilisation determines unit cost.' },
      { slug: 'cg-route-to-market', name: 'Route to market', description: 'Distribution, key accounts, trade terms.', profitPoolNote: 'Where negotiating power with retailers is realised or lost.' },
      { slug: 'cg-brand-marketing', name: 'Brand & marketing', description: 'Brand building, media, content.', profitPoolNote: 'Creates the pricing power everything else depends on.' },
    ],
    kpis: [
      { slug: 'net-revenue-realisation', name: 'Net revenue realisation', definition: 'Gross sales less all trade investment and discounts.', formula: 'Net sales / Gross sales', whyItMatters: 'The gap between list price and what is actually banked. Usually larger than management believes.', valueLever: 'revenue_growth' },
      { slug: 'trade-spend-roi', name: 'Trade spend ROI', definition: 'Incremental profit per unit of trade investment.', formula: 'Incremental gross profit / Trade spend', whyItMatters: 'Trade spend is often the second-largest P&L line and the least measured.', valueLever: 'margin_improvement' },
      { slug: 'otif', name: 'On-time in-full', definition: 'Share of customer orders delivered complete and on schedule.', formula: 'Orders OTIF / Total orders', whyItMatters: 'Retailer fines and delisting risk attach directly to this. It is a commercial KPI, not a logistics one.', valueLever: 'risk_reduction', typicalRange: '95–99% required by major grocers' },
      { slug: 'forecast-accuracy', name: 'Forecast accuracy', definition: 'Accuracy of demand forecast at the planning horizon.', formula: '1 − (|Forecast − Actual| / Actual)', whyItMatters: 'Drives inventory, service and production efficiency simultaneously. The clearest single target for demand-planning AI.', valueLever: 'productivity', typicalRange: '60–85% at SKU-week' },
    ],
    businessModels: [
      { slug: 'branded-fmcg', name: 'Branded FMCG', description: 'Sells branded products through retail intermediaries.', economics: 'Brand supports price premium; retailer power caps it.', examples: ['Nestlé', 'Unilever'] },
      { slug: 'dtc-brand', name: 'Direct-to-consumer brand', description: 'Owns the customer relationship end to end.', economics: 'Higher gross margin, high acquisition cost; profitability depends on repeat rate.', examples: ['challenger brands'] },
    ],
    capabilities: [
      { slug: 'revenue-growth-management', name: 'Revenue growth management', description: 'Price pack architecture, promotion and trade term optimisation.', stageSlug: 'cg-route-to-market', dimensions: ['data', 'decision_rights', 'performance_management'] },
      { slug: 'demand-sensing', name: 'Demand sensing', description: 'Short-horizon forecasting from point-of-sale and external signals.', stageSlug: 'cg-route-to-market', dimensions: ['data', 'technology'] },
      { slug: 'integrated-business-planning', name: 'Integrated business planning', description: 'One reconciled plan across demand, supply and finance.', stageSlug: 'cg-manufacturing', dimensions: ['process', 'governance', 'decision_rights'] },
    ],
  },

  {
    slug: 'technology-ai',
    name: 'Technology & AI',
    definition:
      'Providers of compute, models, platforms and applications, including the AI stack. Economically distinct from its customers: value accrues to whoever controls a scarce layer — compute, frontier models, distribution or proprietary data — and the location of that scarcity has moved repeatedly.',
    marketStructure:
      'A layered stack. Semiconductors and accelerated compute are highly concentrated; cloud is an oligopoly; frontier model development is capital-intensive and concentrated among a few labs; the application layer is fragmented and contestable. Hyperscalers are simultaneously suppliers, customers and competitors to model developers, which makes announced partnerships harder to read than they look.',
    regulatoryEnvironment:
      'EU AI Act with risk-tiered obligations phasing in; data protection (GDPR); the EU Data Act; sectoral rules for AI in finance and healthcare; export controls on advanced semiconductors; copyright litigation over training data, still unresolved in most jurisdictions.',
    transformationAgenda:
      'Moving enterprise AI from pilots to production; agentic systems and tool use; inference cost reduction; evaluation and guardrails as a discipline; data platform consolidation as the precondition for everything else; the shift from model capability to deployment capability as the binding constraint.',
    openQuestions: [
      'What share of announced enterprise AI deployments reach production with a measured business outcome?',
      'Where does the margin settle across compute, model and application layers?',
      'How much of current agentic capability survives contact with real enterprise process complexity?',
    ],
    sourceRefs: [
      { label: 'EU Artificial Intelligence Act', url: 'https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai' },
      { label: 'NIST AI Risk Management Framework', url: 'https://www.nist.gov/itl/ai-risk-management-framework' },
    ],
    valueChainStages: [
      { slug: 'tech-semiconductors', name: 'Semiconductors & accelerated compute', description: 'Chip design, fabrication, accelerators, networking.', profitPoolNote: 'Currently the largest and most concentrated profit pool in the stack.' },
      { slug: 'tech-cloud', name: 'Cloud infrastructure', description: 'Compute, storage and networking as a service.', profitPoolNote: 'Scale economics with high switching costs; the distribution channel for everything above it.' },
      { slug: 'tech-models', name: 'Foundation models', description: 'Training and serving general-purpose models.', profitPoolNote: 'Capital-intensive; margin depends on inference cost curves and on whether capability advantages persist.' },
      { slug: 'tech-platform', name: 'AI platform & tooling', description: 'Orchestration, retrieval, evaluation, guardrails, observability.', profitPoolNote: 'Where enterprise deployment friction is monetised.' },
      { slug: 'tech-applications', name: 'Applications', description: 'Task- and industry-specific software.', profitPoolNote: 'Fragmented and contestable; proprietary workflow data is the durable advantage.' },
      { slug: 'tech-services', name: 'Integration & services', description: 'Implementation, change management, managed operations.', profitPoolNote: 'Grows when the constraint is organisational rather than technical — which is the current state.' },
    ],
    kpis: [
      { slug: 'inference-cost', name: 'Cost per inference', definition: 'Fully loaded cost of serving one model request.', formula: 'Total serving cost / Requests', whyItMatters: 'Determines which use cases are economic. A use case that fails on unit cost fails regardless of model quality.', valueLever: 'cost_reduction' },
      { slug: 'pilot-to-production', name: 'Pilot-to-production conversion', definition: 'Share of AI pilots reaching production use.', formula: 'Pilots in production / Pilots started', whyItMatters: 'The honest measure of an AI programme. Announcement counts measure communication, not capability.', valueLever: 'productivity', typicalRange: 'Widely reported as low; comparable figures are scarce' },
      { slug: 'net-revenue-retention', name: 'Net revenue retention', definition: 'Revenue from existing customers including expansion and churn.', formula: 'End-period revenue from cohort / Start-period revenue', whyItMatters: 'Distinguishes products customers keep using from products they trialled.', valueLever: 'customer_retention', typicalRange: '100–130% for healthy enterprise software' },
      { slug: 'model-eval-pass-rate', name: 'Evaluation pass rate', definition: 'Share of a task suite passed at a defined quality bar.', formula: 'Passing cases / Total evaluation cases', whyItMatters: 'The only defensible basis for claiming a system is fit for a task. Vendor benchmarks rarely match a customer suite.', valueLever: 'risk_reduction' },
    ],
    businessModels: [
      { slug: 'hyperscaler', name: 'Hyperscale cloud', description: 'Infrastructure at scale with a broad managed-service catalogue.', economics: 'Capital intensive, high switching cost, monetises consumption.', examples: ['Microsoft', 'Google', 'Amazon'] },
      { slug: 'model-provider', name: 'Foundation model provider', description: 'Trains and serves general-purpose models via API.', economics: 'Very high fixed training cost; margin follows inference efficiency and distribution.', examples: ['OpenAI', 'Anthropic'] },
      { slug: 'accelerated-compute', name: 'Accelerated compute vendor', description: 'Designs and sells AI accelerators and the surrounding software stack.', economics: 'Ecosystem lock-in through developer tooling; demand tracks capex cycles.', examples: ['NVIDIA'] },
      { slug: 'enterprise-saas', name: 'Enterprise SaaS', description: 'Subscription software for a defined business process.', economics: 'Recurring revenue, expansion-led growth, retention is the value driver.', examples: ['Palantir'] },
    ],
    capabilities: [
      { slug: 'ml-platform', name: 'ML/AI platform engineering', description: 'Training, serving, monitoring and cost control for models in production.', stageSlug: 'tech-platform', dimensions: ['technology', 'talent', 'funding'] },
      { slug: 'ai-governance', name: 'AI governance', description: 'Risk classification, approval, monitoring and audit of AI systems.', stageSlug: 'tech-platform', dimensions: ['governance', 'decision_rights', 'compliance' as string] },
      { slug: 'data-foundation', name: 'Data foundation', description: 'Governed, accessible, quality-controlled data products.', stageSlug: 'tech-platform', dimensions: ['data', 'governance', 'organization'] },
      { slug: 'agentic-orchestration', name: 'Agentic orchestration', description: 'Multi-step tool-using systems with evaluation and human oversight.', stageSlug: 'tech-platform', dimensions: ['technology', 'process', 'change_adoption'] },
    ],
  },
];

export const TOPICS = [
  { slug: 'artificial-intelligence', name: 'Artificial Intelligence', description: 'Machine learning and AI systems applied to business problems.' },
  { slug: 'generative-ai', name: 'Generative AI', description: 'Models that produce text, image, code or audio.' },
  { slug: 'agentic-ai', name: 'Agentic AI', description: 'Systems that plan and act across multiple steps using tools.' },
  { slug: 'supply-chain', name: 'Supply Chain', description: 'Sourcing, production, logistics and fulfilment.' },
  { slug: 'sustainability', name: 'Sustainability', description: 'Environmental impact, circularity and reporting.' },
  { slug: 'digital-commerce', name: 'Digital Commerce', description: 'Online selling, marketplaces and unified commerce.' },
  { slug: 'pricing', name: 'Pricing', description: 'Price architecture, promotion and markdown.' },
  { slug: 'cost-transformation', name: 'Cost Transformation', description: 'Structural cost reduction programmes.' },
  { slug: 'mergers-acquisitions', name: 'Mergers & Acquisitions', description: 'Portfolio moves, acquisitions and divestitures.' },
  { slug: 'regulation', name: 'Regulation', description: 'Regulatory change affecting market participants.' },
  { slug: 'workforce', name: 'Workforce', description: 'Talent, skills and ways of working.' },
  { slug: 'cybersecurity', name: 'Cybersecurity', description: 'Security posture, incidents and controls.' },
  { slug: 'data-platforms', name: 'Data Platforms', description: 'Data infrastructure, governance and products.' },
  { slug: 'customer-experience', name: 'Customer Experience', description: 'Service, personalisation and loyalty.' },
];

export const TECHNOLOGIES = [
  { slug: 'large-language-models', name: 'Large Language Models', layer: 'model', description: 'General-purpose text models used for generation, extraction and reasoning.', enables: ['agentic-orchestration', 'personalisation'] },
  { slug: 'machine-learning-forecasting', name: 'Machine Learning Forecasting', layer: 'application', description: 'Statistical and ML models predicting demand and other quantities.', enables: ['demand-forecasting', 'demand-sensing'] },
  { slug: 'computer-vision', name: 'Computer Vision', layer: 'model', description: 'Image and video understanding.', enables: ['supply-traceability'] },
  { slug: 'cloud-infrastructure', name: 'Cloud Infrastructure', layer: 'infrastructure', description: 'Elastic compute, storage and networking.', enables: ['ml-platform'] },
  { slug: 'ai-accelerators', name: 'AI Accelerators', layer: 'infrastructure', description: 'GPUs and purpose-built chips for training and inference.', enables: ['ml-platform'] },
  { slug: 'data-platform', name: 'Data Platform', layer: 'platform', description: 'Lakehouse, warehouse and governance tooling.', enables: ['data-foundation'] },
  { slug: 'rpa-automation', name: 'Process Automation', layer: 'application', description: 'Rule-based and AI-assisted process automation.', enables: ['workforce-scheduling'] },
  { slug: 'digital-product-passport', name: 'Digital Product Passport', layer: 'application', description: 'Product-level traceability data required by EU regulation.', enables: ['supply-traceability'] },
];

export const GEOGRAPHIES = [
  { slug: 'global', name: 'Global', isoCode: null },
  { slug: 'europe', name: 'Europe', isoCode: null },
  { slug: 'north-america', name: 'North America', isoCode: null },
  { slug: 'asia-pacific', name: 'Asia Pacific', isoCode: null },
  { slug: 'germany', name: 'Germany', isoCode: 'DE', parentSlug: 'europe' },
  { slug: 'sweden', name: 'Sweden', isoCode: 'SE', parentSlug: 'europe' },
  { slug: 'spain', name: 'Spain', isoCode: 'ES', parentSlug: 'europe' },
  { slug: 'united-kingdom', name: 'United Kingdom', isoCode: 'GB', parentSlug: 'europe' },
  { slug: 'united-states', name: 'United States', isoCode: 'US', parentSlug: 'north-america' },
  { slug: 'china', name: 'China', isoCode: 'CN', parentSlug: 'asia-pacific' },
  { slug: 'japan', name: 'Japan', isoCode: 'JP', parentSlug: 'asia-pacific' },
];
