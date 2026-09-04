import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PreferenceForm } from '@/components/preference-form';
import { currentPreferences, preferenceOptions, savePreferences } from '@/lib/preferences';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Preferences' };

/**
 * The same form as onboarding, reachable forever.
 *
 * Sharing the component is the point: a first-run wizard that diverges from the settings
 * screen is how fields end up settable once and never again.
 */
export default async function PreferencesPage() {
  const [options, current] = [await preferenceOptions(), await currentPreferences()];

  async function submit(formData: FormData) {
    'use server';
    await savePreferences(formData);
    redirect('/profile');
  }

  return (
    <div className="mx-auto max-w-[760px]">
      <p className="t-eyebrow">Preferences</p>
      <h1 className="mt-2 text-[27px] font-semibold leading-[1.16] tracking-[-0.028em]">
        What NORTH is about, for you
      </h1>
      <p className="mt-3 max-w-[64ch] text-[14px] leading-[1.68] text-[var(--text-muted)]">
        Changing these re-ranks tomorrow&rsquo;s brief. Today&rsquo;s is already assembled — a brief
        is a decision made once, not a query re-run on every page load.
      </p>

      <div className="mt-10">
        <PreferenceForm
          options={options}
          current={current}
          action={submit}
          submitLabel="Save preferences"
        />
      </div>

      <p className="mt-8 text-[12.5px] text-[var(--text-subtle)]">
        <Link href="/profile" className="underline underline-offset-2 hover:text-[var(--text)]">
          Back to profile
        </Link>
      </p>
    </div>
  );
}
