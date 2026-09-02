/**
 * Demo fixtures — illustrative, not real reporting.
 *
 * These exist so the pipeline's harder behaviours can be demonstrated and tested
 * deterministically, offline, and regardless of what the live feeds happen to contain
 * today. They are written to exercise specific cases:
 *
 *   1. a first-party quantified claim with no independent confirmation
 *      → COMPANY_SELF_REPORTING, QUANTIFIED_BUSINESS_IMPACT, not "validated"
 *   2. the same event reported by two sources → one event, two sources, corroborated
 *   3. two sources giving different figures → a visible contradiction, not a merge
 *   4. a pilot described with marketing language → maturity PILOT, not "scaled"
 *   5. a reversal → DISCONTINUED_OR_REVERSED, which ranks as news
 *
 * Everything derived from them is flagged `isDemo` and badged in the UI.
 */

export interface DemoDocument {
  title: string;
  url: string;
  body: string;
  publishedAt: string;
  author?: string;
}

export const DEMO_FIRST_PARTY_DOCUMENTS: DemoDocument[] = [
  {
    title: 'Northwind Apparel reports 18% markdown reduction after AI allocation rollout',
    url: 'https://demo.local/northwind/markdown-reduction',
    publishedAt: '2026-08-26T08:00:00Z',
    author: 'Northwind Apparel Investor Relations',
    body: `Northwind Apparel today announced results from the group-wide rollout of its machine learning allocation platform. The company reported an 18% reduction in markdown rate across its European store estate in the spring/summer season compared with the prior year. Full-price sell-through improved by 4 percentage points over the same period. The platform has been deployed across all 1,240 stores in twelve markets following a pilot in Germany and the Netherlands during 2025. Chief Operating Officer Lena Farkas said the system now generates allocation proposals for every store and size curve twice weekly, replacing a manual process that ran fortnightly. The company said the improvement was driven primarily by earlier reallocation of slow-selling lines between stores. Northwind did not disclose the investment required or the baseline methodology used to calculate the comparison.`,
  },
  {
    title: 'Meridian Retail Group and Halden AI announce strategic partnership on demand forecasting',
    url: 'https://demo.local/meridian/halden-partnership',
    publishedAt: '2026-08-29T09:00:00Z',
    author: 'Meridian Retail Group',
    body: `Meridian Retail Group and Halden AI today announced a strategic partnership to transform demand forecasting across Meridian's grocery and general merchandise business. The multi-year agreement will see Halden's forecasting models integrated into Meridian's replenishment systems. The companies said the partnership represents a revolutionary step for the industry and will deliver best-in-class availability for customers. An initial proof of concept will run in Meridian's Northern region during the fourth quarter, covering approximately 40 stores. Meridian Chief Supply Chain Officer Tomas Reinholt said the group expects to evaluate results before considering wider deployment. No financial terms were disclosed.`,
  },
  {
    title: 'Calder Stores discontinues automated store replenishment programme',
    url: 'https://demo.local/calder/replenishment-discontinued',
    publishedAt: '2026-08-21T16:00:00Z',
    author: 'Calder Stores',
    body: `Calder Stores has discontinued its automated replenishment programme after an eighteen-month deployment across 300 stores. The company said the system did not deliver the expected improvement in on-shelf availability and that store teams frequently overrode its recommendations. Chief Executive Ruth Bellamy said the underlying issue was data quality in store-level inventory records rather than the forecasting models themselves, and that the group would prioritise inventory accuracy before revisiting automation. The programme had been announced in early 2025 as a group-wide transformation initiative. Calder will retain the demand forecasting component for central planning.`,
  },
];

/**
 * Independent trade-press fixtures. A separate source with an INDUSTRY_MEDIA
 * perspective, so the demo exercises cross-source corroboration and the difference
 * between a company's own account and somebody else's.
 */
export const DEMO_INDEPENDENT_DOCUMENTS: DemoDocument[] = [
  {
    title: 'Northwind allocation results draw questions over baseline',
    url: 'https://demo.local/retailobserver/northwind-baseline-questions',
    publishedAt: '2026-08-28T11:30:00Z',
    author: 'Retail Observer (demo publication)',
    body: `Analysts have questioned the comparison underlying Northwind Apparel's reported markdown improvement. The company reported an 18% reduction in markdown rate this week. Two analysts covering the stock noted that the prior-year comparison period included an unusually heavy clearance programme following an over-buy in outerwear, which would flatter any year-on-year comparison. Northwind declined to provide the underlying baseline figures. One analyst estimated the underlying improvement at closer to 7% once the prior-year clearance is normalised. The company maintains its reported figure is calculated on a like-for-like basis.`,
  },
  {
    title: 'Halden AI signs Meridian as anchor European retail customer',
    url: 'https://demo.local/techwire/halden-meridian',
    publishedAt: '2026-08-29T14:15:00Z',
    author: 'TechWire (demo publication)',
    body: `Halden AI has signed Meridian Retail Group as its anchor European retail customer, the companies confirmed on Friday. The agreement covers demand forecasting for Meridian's grocery and general merchandise operations and begins with a proof of concept in around 40 stores in the fourth quarter. Halden AI, founded in 2022, provides forecasting models for retail replenishment. The company has not previously disclosed a European customer of Meridian's size. Industry observers noted that the proof-of-concept structure is typical for forecasting deployments, where accuracy improvements are difficult to verify before a full seasonal cycle has run.`,
  },
  {
    title: 'EU textile traceability rules move to product-level data from 2027',
    url: 'https://demo.local/policywatch/textile-traceability',
    publishedAt: '2026-08-27T07:45:00Z',
    author: 'Policy Watch (demo publication)',
    body: `Textile producers selling into the European Union will be required to provide product-level traceability data from 2027 under implementing rules published this week. The requirements cover material composition, country of processing and recycled content at individual product level. Industry bodies have warned that tier-two and tier-three supplier data remains the principal obstacle, with most brands currently able to trace reliably only to tier one. The rules apply to all producers placing textile products on the EU market regardless of where manufacturing takes place. Compliance will require changes to product data management systems and supplier contracts.`,
  },
];
