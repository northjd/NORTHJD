/**
 * Learning content seed — evergreen, versioned, dated.
 *
 * Written at three depths so the same concept can be met at Foundation, Executive or
 * Expert level. This is the content that makes an event more than a headline: an
 * announcement about allocation is only meaningful to someone who knows what
 * allocation decides.
 */

export interface LearningUnitSeed {
  slug: string;
  title: string;
  depth: 'foundation' | 'executive' | 'expert';
  position: number;
  conceptSlug: string;
  objective: string;
  explanation: string;
  structuredModel: { heading: string; points: string[] }[];
  keyTerms: { term: string; definition: string }[];
  coreMetricSlugs: string[];
  exampleCompanyNames: string[];
  commonMisconceptions: string[];
  practicalQuestions: string[];
  sourceRefs: { label: string; url: string }[];
  estimatedMinutes: number;
  knowledgeCheck?: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
}

export interface LearningPathSeed {
  slug: string;
  name: string;
  description: string;
  industrySlug: string;
  position: number;
  units: LearningUnitSeed[];
}

export const LEARNING_PATHS: LearningPathSeed[] = [
  {
    slug: 'fashion-retail-economics',
    name: 'The economics of fashion retail',
    description:
      'How a fashion retailer actually makes money, and why almost every strategic problem in the sector reduces to a timing problem.',
    industrySlug: 'fashion-apparel',
    position: 1,
    units: [
      {
        slug: 'fashion-how-money-is-made',
        title: 'How fashion retailers make money',
        depth: 'foundation',
        position: 1,
        conceptSlug: 'fashion-economics',
        objective: 'Explain where gross margin comes from in fashion retail and what destroys it.',
        explanation:
          "A fashion retailer buys product months before it knows whether anyone wants it, then has a limited window to sell it before the value decays. Gross margin is set at two moments: when the buying price is agreed, and when the selling price is finally realised after any markdown. Everything between those two points — allocation, replenishment, pricing cadence — is about protecting the gap. The industry's recurring failure mode is not buying badly but buying too much of the wrong thing too early, then discounting to recover cash. That is why full-price sell-through, not revenue, is the number practitioners watch.",
        structuredModel: [
          {
            heading: 'The margin equation',
            points: [
              'Cost price is fixed at order commitment, months ahead',
              'Realised price is what the customer actually paid after markdown',
              'Gross margin is the gap, less shrink and returns',
              'Working capital is consumed the whole time the stock is unsold',
            ],
          },
          {
            heading: 'Where it goes wrong',
            points: [
              'Over-buying: too many units committed pre-season',
              'Mis-allocation: right units, wrong stores',
              'Late reaction: markdown taken too late to clear at a reasonable price',
              'Returns: a digital order that comes back cost money twice',
            ],
          },
          {
            heading: 'The structural constraint',
            points: [
              'Production lead times of 8–40 weeks force pre-season commitment',
              'Shortening lead time reduces the size of the bet, which is why speed is strategic rather than operational',
            ],
          },
        ],
        keyTerms: [
          {
            term: 'Open-to-buy',
            definition:
              'The budget still available for future purchases in a plan period. The control that stops merchandising over-committing.',
          },
          {
            term: 'Markdown',
            definition:
              'A permanent price reduction taken to clear stock. Distinct from a promotion, which is temporary.',
          },
          {
            term: 'Sell-through',
            definition:
              'The share of a buy that has sold, usually measured against plan at a point in the season.',
          },
        ],
        coreMetricSlugs: [
          'full-price-sell-through',
          'markdown-rate',
          'gross-margin',
          'sell-through-rate',
        ],
        exampleCompanyNames: ['H&M Group', 'Inditex', 'Uniqlo'],
        commonMisconceptions: [
          'That revenue growth indicates health — revenue bought with markdown can destroy margin.',
          'That the discount decision is a pricing problem. It is usually a buying decision surfacing months later.',
          'That faster supply chains are only about cost. Their main value is reducing the size of the pre-season bet.',
        ],
        practicalQuestions: [
          'What is your full-price sell-through, and how has it moved over three seasons?',
          "How much of last season's markdown was planned, and how much was recovery?",
          'How long is your design-to-shelf cycle, and what is the binding constraint on shortening it?',
        ],
        sourceRefs: [
          { label: 'H&M Group annual reporting', url: 'https://hmgroup.com/investors/' },
        ],
        estimatedMinutes: 6,
        knowledgeCheck: {
          question:
            'A retailer grows revenue 8% while markdown rate rises from 22% to 29% and full-price sell-through falls. What is the most likely explanation?',
          options: [
            'Successful demand generation through promotional investment',
            'Over-buying, with revenue growth bought through discounting',
            'A pricing systems failure',
            'An improvement in inventory productivity',
          ],
          correctIndex: 1,
          explanation:
            'Rising markdown alongside falling full-price sell-through means units are being cleared rather than sold at intended price. Revenue is up because more units moved, but they moved at a discount — which points upstream to the buy, not to pricing execution.',
        },
      },
      {
        slug: 'fashion-merchandising-executive',
        title: 'Merchandising decisions that determine margin, availability and markdown',
        depth: 'executive',
        position: 2,
        conceptSlug: 'merchandise-planning',
        objective:
          'Identify the small number of merchandising decisions that set the financial outcome of a season.',
        explanation:
          'Merchandising converts a financial plan into unit commitments. Four decisions dominate the outcome: how much to commit pre-season versus hold open for in-season reaction; how to split depth against breadth; how to cluster stores so allocation has something meaningful to allocate against; and when to take the first markdown. Each is made under deep uncertainty, and each is made by a different part of the organisation — which is why merchandising problems are almost always decision-rights problems in disguise. When an AI planning system is introduced, the question that decides whether it works is not model accuracy but whether the merchandiser is allowed to be overruled by it.',
        structuredModel: [
          {
            heading: 'The four decisions',
            points: [
              'Pre-season commitment vs. open-to-buy reserve',
              'Depth vs. breadth within the range',
              'Store clustering and size curves',
              'First markdown timing and depth',
            ],
          },
          {
            heading: 'Who decides what',
            points: [
              'Buying owns cost price and supplier relationship',
              'Merchandising owns the financial plan and open-to-buy',
              'Allocation owns unit placement',
              'Retail operations owns execution and can quietly override all of it',
            ],
          },
          {
            heading: 'Why AI planning stalls',
            points: [
              'The model produces a recommendation; the org still requires a human sign-off',
              'Overrides are rarely tracked, so nobody knows whether the model or the merchandiser was right',
              'Without an override-tracking loop there is no way to build trust or to improve',
            ],
          },
        ],
        keyTerms: [
          {
            term: 'Store clustering',
            definition:
              'Grouping stores by demand profile so allocation rules can differ meaningfully between them.',
          },
          {
            term: 'Size curve',
            definition:
              "The distribution of sizes allocated to a location, ideally derived from that location's historical sales rather than a national average.",
          },
          {
            term: 'Override rate',
            definition:
              'How often a human changes a system recommendation. The single most informative metric about an AI planning deployment.',
          },
        ],
        coreMetricSlugs: ['open-to-buy', 'sell-through-rate', 'markdown-rate', 'stock-cover'],
        exampleCompanyNames: ['Inditex', 'H&M Group', 'Zalando'],
        commonMisconceptions: [
          'That better forecasting alone improves margin. It only does if someone acts on it differently.',
          'That allocation is a logistics function. It is a commercial decision with a logistics implementation.',
          'That override rate should be driven to zero. A high override rate with poor outcomes is the real signal.',
        ],
        practicalQuestions: [
          'What share of your buy is committed before the season starts, and how has that moved?',
          'Who can overrule the planning system, and is that override recorded anywhere?',
          'When a store cluster underperforms, how many days pass before stock is reallocated?',
        ],
        sourceRefs: [],
        estimatedMinutes: 8,
        knowledgeCheck: {
          question:
            'A retailer deploys a demand forecasting model. Accuracy improves materially, but markdown does not fall. What should be examined first?',
          options: [
            'The model architecture and feature set',
            'Whether allocation decisions and override rights actually changed',
            'Whether the training data covers enough history',
            'Whether the forecast horizon is long enough',
          ],
          correctIndex: 1,
          explanation:
            'A forecast only creates value through a decision that changes. If merchandisers continue to override recommendations, or the allocation cadence stays fortnightly, improved accuracy has no route to the P&L. This is the most common reason planning deployments fail to show benefit.',
        },
      },
      {
        slug: 'fashion-ai-planning-expert',
        title: 'How AI planning changes decision rights and planning cycles',
        depth: 'expert',
        position: 3,
        conceptSlug: 'in-season-reaction',
        objective:
          'Analyse the organisational changes required before AI-enabled planning delivers measured margin benefit.',
        explanation:
          'Introducing machine-learning allocation into a merchandising organisation changes three things simultaneously: the cadence of decisions, the locus of authority, and the definition of merchandiser performance. Cadence is the easiest — a model can propose reallocation daily where humans managed fortnightly. Authority is harder, because it requires an explicit decision about when a recommendation is advisory and when it is binding, and most organisations avoid making that decision. Performance measurement is hardest: if merchandisers are still evaluated on their own judgement, they have a rational incentive to override. Deployments that show measured margin improvement generally have three things in common — a tracked override loop, a narrow initial scope where the counterfactual is measurable, and a changed performance definition. Deployments that stall usually have excellent models and none of the three.',
        structuredModel: [
          {
            heading: 'What actually changes',
            points: [
              'Decision cadence: fortnightly → daily or twice-weekly',
              'Decision rights: advisory vs. binding recommendations, made explicit',
              'Performance definition: judged on outcome, not on personal call quality',
              'Exception handling: which cases still route to a human, and why',
            ],
          },
          {
            heading: 'Measurement design',
            points: [
              'Hold-out stores or categories to establish a counterfactual',
              'Override tracking with outcome attribution',
              'Baseline defined and frozen before deployment — not reconstructed afterwards',
              'A full seasonal cycle before claiming a result',
            ],
          },
          {
            heading: 'Reading a vendor claim',
            points: [
              'Was the baseline defined before or after the deployment?',
              'Is the comparison like-for-like, or against an anomalous prior period?',
              'Is the scope the whole estate or the best-performing subset?',
              'Has anyone outside the company verified it?',
            ],
          },
        ],
        keyTerms: [
          {
            term: 'Counterfactual',
            definition:
              'What would have happened without the intervention. Without a hold-out group it is an assumption, not a measurement.',
          },
          {
            term: 'Binding recommendation',
            definition:
              'A system output that executes unless a human actively intervenes, as opposed to one that waits for approval.',
          },
          {
            term: 'Baseline drift',
            definition:
              'Quietly re-defining the comparison period so results look better. The most common flaw in self-reported outcome claims.',
          },
        ],
        coreMetricSlugs: ['markdown-rate', 'full-price-sell-through', 'availability', 'gmroi'],
        exampleCompanyNames: [],
        commonMisconceptions: [
          'That a scaled rollout implies measured benefit. Scale is a deployment fact; benefit is a measurement claim.',
          'That vendor case studies establish a benchmark. They describe the best available outcome, not the expected one.',
          'That the constraint is model quality. In most stalled deployments the model is adequate and the operating model is not.',
        ],
        practicalQuestions: [
          'Was the baseline frozen before deployment, and can you see the definition?',
          'What is the override rate, and how does outcome differ between overridden and accepted recommendations?',
          'Was there a hold-out group, and if not, how is the counterfactual established?',
        ],
        sourceRefs: [],
        estimatedMinutes: 11,
        knowledgeCheck: {
          question:
            'A company reports an 18% markdown reduction after a group-wide AI allocation rollout, with no hold-out group and no published baseline methodology. How should this be classified?',
          options: [
            'Independently validated impact',
            'Quantified business impact, self-reported and not independently verified',
            'Scaled deployment with no outcome claim',
            'A pilot',
          ],
          correctIndex: 1,
          explanation:
            'A quantified outcome is stated, so it is more than a deployment claim — but the company is the only party reporting it and no counterfactual is available. It is QUANTIFIED_BUSINESS_IMPACT with COMPANY_SELF_REPORTING evidence, not validated impact. The distinction is exactly what stops an announcement being read as proof.',
        },
      },
    ],
  },

  {
    slug: 'enterprise-ai-deployment',
    name: 'Enterprise AI: from announcement to measured outcome',
    description:
      'How to read AI announcements, distinguish deployment stages, and identify what actually blocks enterprise AI programmes.',
    industrySlug: 'technology-ai',
    position: 2,
    units: [
      {
        slug: 'ai-maturity-ladder',
        title: 'Announcement, deployment, impact: reading the maturity ladder',
        depth: 'foundation',
        position: 1,
        conceptSlug: 'ai-deployment-maturity',
        objective:
          'Distinguish the stages of an AI initiative and identify which stage a given announcement describes.',
        explanation:
          'Most confusion about enterprise AI comes from collapsing three different claims into one. "We are working with vendor X" is an announcement. "It is running in 40 stores" is a deployment. "It reduced markdown by 18%" is an outcome claim. They require different evidence and support different conclusions. A partnership announcement tells you about intent and, often, about what the vendor needs to show its own market. A deployment tells you something worked well enough to be extended. An outcome claim needs a baseline, a counterfactual and ideally someone outside the company confirming it. The most useful habit is to ask, of any AI story, which of the three it actually is.',
        structuredModel: [
          {
            heading: 'The ladder',
            points: [
              'Announced — intent stated, nothing built',
              'Concept — being explored or prototyped',
              'Pilot — running in a bounded scope to learn',
              'Limited deployment — live in selected locations or units',
              'Scaled deployment — live across the organisation',
              'Quantified impact — a measured outcome is claimed',
              'Independently validated — someone outside confirms the outcome',
              'Discontinued — stopped or reversed',
            ],
          },
          {
            heading: 'Evidence required at each step',
            points: [
              'Announcement: a press release is sufficient evidence of the announcement itself',
              'Deployment: a stated scope — sites, users, transactions',
              'Impact: a metric, a baseline, a period and a method',
              'Validation: a source that is not the party benefiting',
            ],
          },
        ],
        keyTerms: [
          {
            term: 'Pilot',
            definition:
              'A bounded deployment whose purpose is learning, not value. Success is a decision, not a return.',
          },
          {
            term: 'Self-reported',
            definition:
              'Stated by the party with an interest in the result. Not false by default; not independent either.',
          },
          {
            term: 'Production',
            definition:
              'Running as part of normal operations, with the support and reliability obligations that implies.',
          },
        ],
        coreMetricSlugs: ['pilot-to-production', 'inference-cost'],
        exampleCompanyNames: ['Microsoft', 'OpenAI', 'NVIDIA'],
        commonMisconceptions: [
          'That a partnership announcement indicates deployment.',
          'That a pilot indicates imminent scaling. Most pilots do not scale, and that is a legitimate outcome.',
          'That a discontinued programme was a failure of technology. It is more often data quality or adoption.',
        ],
        practicalQuestions: [
          'Which rung of the ladder does this announcement actually describe?',
          'What scope is stated — sites, users, transactions?',
          'Who is reporting the outcome, and what would independent confirmation look like?',
        ],
        sourceRefs: [
          {
            label: 'NIST AI Risk Management Framework',
            url: 'https://www.nist.gov/itl/ai-risk-management-framework',
          },
        ],
        estimatedMinutes: 6,
        knowledgeCheck: {
          question:
            'A vendor announces a "strategic partnership to transform demand forecasting", with a proof of concept in 40 stores in Q4. What maturity is this?',
          options: [
            'Scaled deployment',
            'Quantified business impact',
            'Pilot',
            'Independently validated impact',
          ],
          correctIndex: 2,
          explanation:
            'The transformation language describes ambition; the stated scope is a proof of concept in a bounded set of stores. The maturity is PILOT. Reading the scope rather than the adjectives is the whole skill.',
        },
      },
      {
        slug: 'ai-value-realisation-executive',
        title: 'Why enterprise AI stalls between pilot and production',
        depth: 'executive',
        position: 2,
        conceptSlug: 'ai-deployment-maturity',
        objective:
          'Explain the recurring non-technical constraints on scaling AI, and what to ask about each.',
        explanation:
          'The gap between a working pilot and a production system is rarely closed by better models. Four constraints recur: data foundations that are adequate for a demo and not for daily operations; decision rights that were never changed, so recommendations remain advisory; the absence of an evaluation regime, which means nobody can say whether the system is good enough to trust unsupervised; and unit economics that work at pilot volume and not at full volume. A useful diagnostic is to ask what would have to change for the system to run without a human approving each output. The answer names the real constraint, and it is almost never the model.',
        structuredModel: [
          {
            heading: 'The four constraints',
            points: [
              'Data: pilot-grade data quality does not survive daily operation',
              'Decision rights: advisory outputs produce no change in behaviour',
              'Evaluation: without a task suite there is no basis for trusting the system',
              'Unit economics: cost per inference at full volume may not clear the value bar',
            ],
          },
          {
            heading: 'Diagnostic questions',
            points: [
              'What would have to be true to run this without human approval?',
              'Who is accountable when the system is wrong?',
              'What is the evaluation suite, and who owns it?',
              'What is the cost per decision at full volume?',
            ],
          },
        ],
        keyTerms: [
          {
            term: 'Evaluation suite',
            definition:
              'A held-out set of representative tasks with defined pass criteria. The basis for any defensible claim of fitness.',
          },
          {
            term: 'Human in the loop',
            definition:
              'A design where a person approves or corrects output. Often a sensible control; also often the reason no efficiency is realised.',
          },
          {
            term: 'Unit economics',
            definition:
              'Cost and value per decision. Determines which use cases are viable independent of model quality.',
          },
        ],
        coreMetricSlugs: ['pilot-to-production', 'model-eval-pass-rate', 'inference-cost'],
        exampleCompanyNames: ['Palantir', 'Microsoft'],
        commonMisconceptions: [
          'That the next model generation removes the constraint. It changes capability, not decision rights.',
          'That a human-in-the-loop design is always the safe choice. It is a control with a measurable cost.',
          'That evaluation is a technical concern. It is the governance mechanism that makes delegation possible.',
        ],
        practicalQuestions: [
          'What is the pilot-to-production conversion rate across the portfolio?',
          'Which pilots stalled, and was the stated reason data, decision rights, evaluation or economics?',
          'Who owns the evaluation suite, and when was it last updated?',
        ],
        sourceRefs: [],
        estimatedMinutes: 9,
      },
    ],
  },
];

/** Concepts referenced by the units above, plus the taxonomy mirrors. */
export const EXTRA_CONCEPTS = [
  {
    slug: 'fashion-economics',
    name: 'Fashion retail economics',
    kind: 'industry_concept',
    industrySlug: 'fashion-apparel',
    summary: 'How a fashion retailer earns and loses gross margin.',
  },
  {
    slug: 'ai-deployment-maturity',
    name: 'AI deployment maturity',
    kind: 'industry_concept',
    industrySlug: 'technology-ai',
    summary: 'The ladder from announcement through deployment to independently validated impact.',
  },
];
