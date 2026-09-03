import { expect, test, type Page } from '@playwright/test';

/**
 * The core user journeys.
 *
 * Each test corresponds to an acceptance criterion, and the assertions check the
 * *trust* behaviour rather than only that a page rendered: that a fact links to its
 * evidence, that a self-reported claim is labelled, that the brief ends.
 */

const EMAIL = 'demo@market-intelligence-os.local';
const PASSWORD = 'demo-password-change-me';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('/');
}

/**
 * Fills a controlled React input reliably.
 *
 * Server-rendered markup is interactive to Playwright before React has hydrated, so a
 * plain `fill` can land before the change handler exists and be discarded — leaving
 * the submit button disabled. Retrying until the button enables makes the test wait
 * for hydration instead of guessing at a delay.
 */
async function fillAndSubmit(page: Page, label: string, text: string, submitName: string) {
  const input = page.getByLabel(label);
  const submit = page.getByRole('button', { name: submitName, exact: true });
  await expect(input).toBeVisible();
  await expect(async () => {
    await input.fill(text);
    await expect(submit).toBeEnabled({ timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  await submit.click();
}

/** Waits until a client component responds, i.e. until React has hydrated. */
async function clickWhenHydrated(page: Page, name: string | RegExp, expected: string | RegExp) {
  const button = page.getByRole('button', { name }).first();
  await expect(button).toBeVisible();
  await expect(async () => {
    await button.click();
    await expect(page.getByText(expected).first()).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000 });
}

test.describe('authentication', () => {
  test('an unauthenticated visitor is sent to the landing page, not a bare password box', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/welcome/);
    // And signing in is one deliberate step from there.
    await page.getByRole('link', { name: /Activate NORTH/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('a wrong password is refused without revealing whether the account exists', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    // Scoped to the form: Next's route announcer is also role="alert".
    await expect(page.locator('form').getByRole('alert')).toContainText(
      'Email or password is incorrect',
    );
  });

  test('valid credentials reach the daily brief', async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

test.describe('Today — the finite daily brief', () => {
  test.beforeEach(async ({ page }) => signIn(page));

  test('shows a bounded selection with a reading estimate', async ({ page }) => {
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toContainText(/development|Nothing new/);
    await expect(page.getByText(/monitored source/i).first()).toBeVisible();
  });

  test('explains why each item was selected', async ({ page }) => {
    const why = page.getByRole('button', { name: 'Why am I seeing this?' }).first();
    test.skip((await why.count()) === 0, 'brief is empty');
    await clickWhenHydrated(page, 'Why am I seeing this?', 'Ranking reasons');
    await expect(page.getByText(/No company or firm receives a ranking bonus/)).toBeVisible();
  });

  test('reaches a real caught-up state that loads nothing further', async ({ page }) => {
    const done = page.getByRole('button', { name: /Mark brief as done/ });
    const caughtUp = page.getByText('You are caught up.');
    if ((await done.count()) === 0) {
      // Already completed earlier in the run.
      await expect(caughtUp).toBeVisible();
      return;
    }
    await clickWhenHydrated(page, /Mark brief as done/, 'You are caught up.');
    await expect(page.getByText(/Nothing more will load here/)).toBeVisible();
  });

  test('states coverage rather than implying completeness', async ({ page }) => {
    await expect(page.getByText(/not a claim about everything that happened/i)).toBeVisible();
  });
});

test.describe('evidence chain', () => {
  test.beforeEach(async ({ page }) => signIn(page));

  test('a fact on an insight navigates to the exact source passage', async ({ page }) => {
    const insightLink = page.locator('a[href^="/insights/"]').first();
    test.skip((await insightLink.count()) === 0, 'no insights in the database');
    await insightLink.click();
    await expect(page).toHaveURL(/\/insights\//);

    // Facts are separated from interpretation.
    await expect(page.getByRole('heading', { name: 'Verified facts' })).toBeVisible();

    const evidenceLink = page.locator('a[href^="/evidence/"]').first();
    test.skip((await evidenceLink.count()) === 0, 'insight has no evidenced fact');
    await evidenceLink.click();

    await expect(page).toHaveURL(/\/evidence\//);
    await expect(page.getByRole('heading', { name: 'The claim' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The passage' })).toBeVisible();
    // The quoted range is highlighted inside the stored document text.
    await expect(page.locator('mark.evidence-highlight')).toBeVisible();
    // Publication and event dates are shown separately.
    // Publication, event and discovery dates are kept distinct.
    await expect(page.getByText('Published', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Discovered by us')).toBeVisible();
    await expect(page.getByText('Claim last verified')).toBeVisible();
  });

  test('an insight separates interpretation from what the source said', async ({ page }) => {
    const insightLink = page.locator('a[href^="/insights/"]').first();
    test.skip((await insightLink.count()) === 0, 'no insights');
    await insightLink.click();
    await expect(page.getByText(/our interpretation/i).first()).toBeVisible();
    await expect(page.getByText('What this does not tell you')).toBeVisible();
  });
});

test.describe('Companion', () => {
  test.beforeEach(async ({ page }) => signIn(page));

  test('answers a covered question with citations', async ({ page }) => {
    await page.goto('/companion');
    await fillAndSubmit(page, 'Ask the Companion', 'What is happening with markdown and allocation in retail?', 'Ask');

    await expect(page.getByText(/As of /).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Verified facts').first()).toBeVisible();
    await expect(page.locator('a[href^="/evidence/"]').first()).toBeVisible();
  });

  test('declines a question the sources cannot answer', async ({ page }) => {
    await page.goto('/companion');
    await fillAndSubmit(
      page,
      'Ask the Companion',
      'What was the exact quarterly revenue of an unlisted Uzbek textile mill in 2019?',
      'Ask',
    );

    await expect(page.getByText(/do not have sufficient verified evidence/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Insufficient evidence')).toBeVisible();
  });

  test('warns against entering confidential information', async ({ page }) => {
    await page.goto('/companion');
    await expect(page.getByText(/Do not enter confidential client or company information/)).toBeVisible();
  });

  test('offers every mode and a response-length control', async ({ page }) => {
    await page.goto('/companion');
    for (const mode of ['Brief me', 'Explain it', 'Explore it', 'Prepare me', 'Challenge me', 'Teach me', 'Capture']) {
      await expect(page.getByRole('button', { name: mode, exact: true })).toBeVisible();
    }
    await expect(page.getByLabel('Length')).toBeVisible();
    await expect(page.getByLabel('Depth')).toBeVisible();
  });

  test('Challenge Me answers with counter-argument or states there is none', async ({ page }) => {
    await page.goto('/companion');
    await page.getByRole('button', { name: 'Challenge me', exact: true }).click();
    await fillAndSubmit(page, 'Ask the Companion', 'Challenge the claim that AI allocation reduces markdown', 'Ask');
    await expect(
      page.getByText(/evidence that cuts against this|No contradicting evidence exists/),
    ).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('Explore', () => {
  test.beforeEach(async ({ page }) => signIn(page));

  test('an industry page carries a real market model', async ({ page }) => {
    await page.goto('/explore/industries/fashion-apparel');
    for (const section of ['Market structure', 'Value chain', 'Business models', 'KPI tree', 'Regulatory environment']) {
      await expect(page.getByRole('heading', { name: section })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Open questions' })).toBeVisible();
  });

  test('a company page states its source coverage and its gaps', async ({ page }) => {
    await page.goto('/explore/companies/hm-group');
    await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Source coverage' })).toBeVisible();
    await expect(page.getByText(/thin timeline means limited monitoring/i)).toBeVisible();
  });

  test('consulting firms are a category, not a dedicated area', async ({ page }) => {
    await page.goto('/explore');

    // On narrow viewports the rail is collapsed behind a toggle, which is the point of
    // it — so open it before asserting what is inside.
    const railToggle = page.getByRole('button', { name: /^Filters/ });
    if (await railToggle.isVisible()) await railToggle.click();

    // Consulting is one source perspective among several, reachable through the same
    // filter as every other kind of source.
    await expect(
      page.getByRole('button', { name: 'Consulting', exact: true }),
    ).toBeVisible();
    // And no top-level navigation entry for them.
    const nav = page.getByRole('navigation', { name: 'Main' }).first();
    await expect(nav).not.toContainText(/Accenture|Consulting|Competitors/);
  });
});

test.describe('Learn', () => {
  test.beforeEach(async ({ page }) => signIn(page));

  test('a learning unit shows depth, misconceptions and a knowledge check', async ({ page }) => {
    await page.goto('/learn/fashion-how-money-is-made');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('How fashion retailers make money');
    await expect(page.getByText('Objective:')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The model' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Check your understanding' })).toBeVisible();
  });

  test('a knowledge check explains the answer rather than only marking it', async ({ page }) => {
    await page.goto('/learn/fashion-how-money-is-made');
    await clickWhenHydrated(page, /Over-buying/, /Rising markdown alongside falling full-price sell-through/);
  });

  test('the three depth levels are distinguishable', async ({ page }) => {
    await page.goto('/learn');
    await expect(page.getByText('foundation').first()).toBeVisible();
    await expect(page.getByText('executive').first()).toBeVisible();
    await expect(page.getByText('expert').first()).toBeVisible();
  });
});

test.describe('Prepare', () => {
  test.beforeEach(async ({ page }) => signIn(page));

  test('builds a meeting brief with facts, questions and known unknowns', async ({ page }) => {
    await page.goto('/prepare');
    const company = page.getByLabel('Company', { exact: true });
    await expect(company).toBeVisible();
    await expect(async () => {
      await company.selectOption({ label: 'H&M Group' });
      // The free-text fallback disappears once a company is selected, which only
      // happens after hydration.
      await expect(page.getByLabel('Company name')).toHaveCount(0, { timeout: 1000 });
    }).toPass({ timeout: 30_000 });
    await page.getByLabel('Meeting objective').fill('Explore appetite for planning transformation');
    await page.getByRole('button', { name: /Build brief/ }).click();

    await expect(page).toHaveURL(/\/prepare\/[0-9a-f-]{36}/, { timeout: 60_000 });
    await expect(page.getByRole('heading', { name: '60-second brief' })).toBeVisible();
    await expect(page.getByText('What this does not tell you')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy brief' })).toBeVisible();
  });
});

test.describe('Admin', () => {
  test.beforeEach(async ({ page }) => signIn(page));

  test('the source registry shows rights status and why a source is not running', async ({ page }) => {
    await page.goto('/admin/sources');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Source registry');
    await expect(page.getByText(/Being publicly reachable is not permission/)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Candidates — registered, not running/ })).toBeVisible();
  });

  test('coverage names the gaps, not only the totals', async ({ page }) => {
    await page.goto('/admin/coverage');
    await expect(page.getByRole('heading', { name: 'Known coverage gaps' })).toBeVisible();
    await expect(page.getByText(/regulatory filings connector/)).toBeVisible();
  });

  test('capabilities report what is not configured', async ({ page }) => {
    await page.goto('/admin/capabilities');
    await expect(page.getByRole('heading', { name: 'Generation mode' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Not implemented' })).toBeVisible();
  });

  test('the evaluation suite passes in the running system', async ({ page }) => {
    await page.goto('/admin/evaluation');
    await expect(page.getByText('All checks pass')).toBeVisible({ timeout: 60_000 });
  });
});

test.describe('presentation', () => {
  test('works on a mobile viewport', async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole('navigation', { name: 'Main' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('labels demo data wherever it appears', async ({ page }) => {
    await signIn(page);
    await page.goto('/explore/companies/northwind-apparel');
    await expect(page.getByText('Demo data').or(page.getByText('Demo entity')).first()).toBeVisible();
  });
});
