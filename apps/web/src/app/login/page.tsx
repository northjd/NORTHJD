import { Wordmark } from '@/components/wordmark';
import { redirect } from 'next/navigation';
import { currentUser, signIn } from '@/lib/session';
import { config } from '@mios/config';

export const dynamic = 'force-dynamic';

async function loginAction(formData: FormData) {
  'use server';
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const result = await signIn(email, password);
  if (!result.ok) redirect(`/login?error=${encodeURIComponent(result.error ?? 'Sign-in failed')}`);
  redirect('/');
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await currentUser()) redirect('/');
  const { error } = await searchParams;
  const isDev = config().NODE_ENV !== 'production';

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span
            aria-hidden
            className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded bg-[var(--accent)] text-[16px] font-bold text-[var(--surface)]"
          >
            M
          </span>
          <h1 className="sr-only">NORTH</h1>
          <Wordmark size="lg" />
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            Know what changed, understand why it matters, and be ready to discuss it.
          </p>
        </div>

        <form action={loginAction} className="surface space-y-3 p-5">
          {error ? (
            <p role="alert" className="rounded bg-alert-100 px-3 py-2 text-[13px] text-alert-700">
              {error}
            </p>
          ) : null}

          <div>
            <label htmlFor="email" className="mb-1 block text-[13px] font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px]"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-[13px] font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px]"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded bg-[var(--accent)] px-3 py-2 text-[14px] font-medium text-[var(--surface)]"
          >
            Sign in
          </button>
        </form>

        {isDev ? (
          <p className="mt-4 rounded border border-[var(--border)] bg-[var(--surface-inset)] px-3 py-2 text-[12px] leading-relaxed text-[var(--text-muted)]">
            <strong className="font-semibold">Development seed account:</strong>{' '}
            demo@market-intelligence-os.local / demo-password-change-me. Created by{' '}
            <code>npm run db:seed</code>. Change it before exposing this anywhere.
          </p>
        ) : null}
      </div>
    </main>
  );
}
