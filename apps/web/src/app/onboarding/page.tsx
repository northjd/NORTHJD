import { redirect } from 'next/navigation';
import { PreferenceForm } from '@/components/preference-form';
import { currentPreferences, preferenceOptions, savePreferences } from '@/lib/preferences';
import { Wordmark } from '@/components/wordmark';
import { config } from '@mios/config';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Set up' };

/**
 * First run.
 *
 * Deliberately outside the `(app)` route group: that layout redirects unonboarded users
 * here, so living inside it would redirect this page to itself. It also has no business
 * showing a sidebar — set-up is one task, and the chrome would invite you to skip it.
 *
 * Ranking has always consumed these fields; until now nothing could set them, so every
 * new account got a brief assembled for somebody else's interests. Six questions, all
 * optional, each stating what it actually changes.
 */
export default async function OnboardingPage() {
  // Someone who has already been through this should not be able to go round again by
  // typing the URL — the form is at /profile/preferences from then on.
  const current = await currentPreferences();
  // In open mode the shared profile is always "onboarded", so the browser cookie decides
  // whether this page is shown — see the note in the (app) layout.
  const openMode = config().AUTH_MODE === 'open';
  if (!openMode && current.onboarded) redirect('/profile/preferences');
  const options = await preferenceOptions();

  async function submit(formData: FormData) {
    'use server';
    await savePreferences(formData);
    redirect('/');
  }

  return (
    <main className="mx-auto min-h-dvh max-w-[760px] px-6 py-12">
      <Wordmark size="md" />
      <p className="t-eyebrow mt-8">Set up</p>
      <h1 className="mt-2 text-[27px] font-semibold leading-[1.16] tracking-[-0.028em]">
        What should NORTH be about, for you?
      </h1>
      <p className="mt-3 max-w-[64ch] text-[14px] leading-[1.68] text-[var(--text-muted)]">
        Six questions. Every one is optional and every one is changeable later. What they
        set is which developments reach your daily brief, how long that brief is, and how
        much the Companion explains as it goes.
      </p>

      {config().AUTH_MODE === 'open' ? (
        <p className="mt-4 max-w-[64ch] border-l border-caution-500/50 pl-4 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
          This deployment has no accounts, so preferences are shared: whatever you set here
          replaces what the last person set. Fine while a few people are looking at it,
          and the reason accounts exist.
        </p>
      ) : null}

      <div className="mt-10">
        <PreferenceForm
          options={options}
          current={current}
          action={submit}
          submitLabel="Start reading"
        />
      </div>

      <p className="mt-6 text-[12.5px] text-[var(--text-subtle)]">
        {/* A plain anchor, not a Link: the target is a route handler, and Next's client
            router navigates to it without following the redirect or storing the cookie
            it sets — which sent you straight back here. */}
        <a href="/onboarding/skip" className="underline underline-offset-2 hover:text-[var(--text)]">
          Skip for now
        </a>{' '}
        — you will get a general brief, and can set this up later from your profile.
      </p>
    </main>
  );
}
