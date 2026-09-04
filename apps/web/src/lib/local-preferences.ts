/**
 * Preferences in the browser.
 *
 * The static build has no database, so what a person chooses lives in their own browser
 * storage. That is not merely the fallback — it is better than what the hosted open-access
 * build does, where everyone shares one profile and the last person through overwrites
 * the previous one. Here each colleague opening the same URL keeps their own.
 *
 * What it cannot do is re-rank the daily brief: that is assembled once at build time, on
 * a machine that has never met you. Preferences drive what is filtered and what the saved
 * views point at, which is what "an initial filter for my areas" actually asks for.
 */

const KEY = 'north:preferences';

export interface LocalPreferences {
  role: string;
  industries: string[];
  topics: string[];
  technologies: string[];
  companies: string[];
  dailyReadingMinutes: number;
  preferredDepth: 'foundation' | 'executive' | 'expert';
  completedAt: string | null;
}

export const EMPTY_PREFERENCES: LocalPreferences = {
  role: '',
  industries: [],
  topics: [],
  technologies: [],
  companies: [],
  dailyReadingMinutes: 12,
  preferredDepth: 'executive',
  completedAt: null,
};

export function readPreferences(): LocalPreferences {
  if (typeof window === 'undefined') return EMPTY_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_PREFERENCES;
    // Merged over the defaults so a stored object written by an older build cannot
    // produce undefined arrays downstream.
    return { ...EMPTY_PREFERENCES, ...(JSON.parse(raw) as Partial<LocalPreferences>) };
  } catch {
    return EMPTY_PREFERENCES;
  }
}

export function writePreferences(next: Partial<LocalPreferences>): LocalPreferences {
  const merged: LocalPreferences = {
    ...readPreferences(),
    ...next,
    completedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    // Private browsing: set-up simply asks again next time rather than failing.
  }
  return merged;
}

export function hasCompletedSetup(): boolean {
  return Boolean(readPreferences().completedAt);
}

/** The saved views a set of preferences implies, as Explore query strings. */
export function savedViewsFor(prefs: LocalPreferences): { label: string; href: string }[] {
  const views: { label: string; href: string }[] = [];
  if (prefs.industries.length) {
    views.push({ label: 'My industries', href: `/explore?industry=${prefs.industries.join(',')}` });
  }
  if (prefs.companies.length) {
    views.push({ label: 'My companies', href: `/explore?company=${prefs.companies.join(',')}` });
  }
  if (prefs.topics.length) {
    views.push({ label: 'My topics', href: `/explore?topic=${prefs.topics.join(',')}` });
  }
  views.push({ label: 'This week', href: '/explore?within=7' });
  return views;
}
