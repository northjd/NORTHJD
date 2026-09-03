import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Wordmark } from '@/components/wordmark';
import { currentUser, signUp } from '@/lib/session';
import { config } from '@mios/config';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Create an account' };

async function signUpAction(formData: FormData) {
  'use server';
  const result = await signUp({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
    name: String(formData.get('name') ?? ''),
    inviteCode: String(formData.get('inviteCode') ?? ''),
  });
  if (!result.ok) {
    redirect(`/signup?error=${encodeURIComponent(result.error ?? 'Sign-up failed')}`);
  }
  redirect('/');
}

/**
 * Account creation, gated by an invite code.
 *
 * Each colleague gets their own user rather than sharing one login, because the product
 * is personal on purpose: your reading history, your saved insights, your knowledge
 * state, your numbers. Sharing an account would make all of that meaningless.
 *
 * The corpus stays shared — everyone joins the same workspace — so people are looking at
 * the same evidence and can disagree about the same thing.
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await currentUser()) redirect('/');
  const { error } = await searchParams;
  const enabled = Boolean(config().SIGNUP_INVITE_CODE);

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <h1 className="sr-only">Create a NORTH account</h1>
          <Wordmark size="lg" />
          <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
            Know what changed. Understand what matters. Be ready for what&rsquo;s next.
          </p>
        </div>

        {!enabled ? (
          <div className="surface p-6 text-center">
            <p className="text-[13.5px] leading-relaxed text-[var(--text-muted)]">
              Sign-up is closed on this deployment. Ask whoever runs it for an invite code,
              or{' '}
              <Link href="/login" className="underline underline-offset-2 hover:text-[var(--text)]">
                sign in
              </Link>{' '}
              if you already have an account.
            </p>
          </div>
        ) : (
          <form action={signUpAction} className="surface space-y-4 p-6">
            {error ? (
              <p
                role="alert"
                className="border-l-2 border-alert-500 pl-3 text-[12.5px] leading-relaxed text-alert-700 dark:text-alert-100"
              >
                {error}
              </p>
            ) : null}

            <Field
              label="Invite code"
              name="inviteCode"
              type="text"
              hint="From whoever shared NORTH with you."
              required
            />
            <Field label="Name" name="name" type="text" autoComplete="name" required />
            <Field label="Email" name="email" type="email" autoComplete="email" required />
            <Field
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
              hint="At least 12 characters. This is a shared deployment."
              required
            />

            <button
              type="submit"
              className="w-full rounded bg-[var(--accent)] px-3 py-2 text-[14px] font-medium text-[var(--surface)]"
            >
              Create account
            </button>

            <p className="text-[11.5px] leading-relaxed text-[var(--text-subtle)]">
              Your reading history and notes are yours. The sources and evidence are shared
              with everyone else in the workspace.
            </p>
          </form>
        )}

        <p className="mt-5 text-center text-[12.5px] text-[var(--text-subtle)]">
          Already have an account?{' '}
          <Link href="/login" className="underline underline-offset-2 hover:text-[var(--text)]">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  type,
  hint,
  autoComplete,
  required,
}: {
  label: string;
  name: string;
  type: string;
  hint?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px] font-medium">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        className="w-full rounded border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)]"
      />
      {hint ? (
        <span className="mt-1 block text-[11px] text-[var(--text-subtle)]">{hint}</span>
      ) : null}
    </label>
  );
}
