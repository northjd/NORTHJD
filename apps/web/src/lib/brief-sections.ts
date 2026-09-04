/**
 * What each brief section is called and what it promises.
 *
 * Split out of lib/brief so the browser can use it. That module opens a database
 * connection on import, which is fine for a server component and fatal for a client one —
 * and the static build composes Today in the browser, where these headings still have to
 * read exactly as they do on the server.
 */

export const SECTION_META: Record<string, { title: string; hint: string }> = {
  executive_three: {
    title: 'The three that matter',
    hint: 'Highest combined relevance, impact and evidence strength today.',
  },
  what_changed: {
    title: 'Changed since your last visit',
    hint: 'Only genuinely new, updated or corrected developments.',
  },
  company_watch: {
    title: 'Your companies',
    hint: 'Developments at organisations on your watchlist.',
  },
  industry_signals: { title: 'Your industries', hint: 'Signals from the industries you follow.' },
  tech_radar: {
    title: 'Technology radar',
    hint: 'What providers and platforms announced, built or shipped.',
  },
  broader_market: {
    title: 'Broader market',
    hint: 'Economic, regulatory and market developments beyond your focus.',
  },
  adjacent_signal: {
    title: 'One adjacent signal',
    hint: 'Deliberately outside your stated interests, to keep the brief from closing in on itself.',
  },
  learn_one_thing: {
    title: 'Learn one thing',
    hint: 'A short fundamentals unit connected to what you read.',
  },
  deep_dive: { title: 'Deep dive', hint: 'Longer material for durable understanding.' },
  prepare_next: { title: 'Prepare for what is next', hint: 'Relevant to an upcoming meeting.' },
};

export const SECTION_ORDER = [
  'executive_three',
  'what_changed',
  'company_watch',
  'industry_signals',
  'tech_radar',
  'broader_market',
  'adjacent_signal',
  'learn_one_thing',
  'deep_dive',
  'prepare_next',
];
