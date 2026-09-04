/**
 * Builds the shareable static site.
 *
 * A static export has no server, so anything that needs one has to go: API routes,
 * server actions that write, and every page that reads cookies or a query string at
 * request time. Rather than scattering `if (STATIC_EXPORT)` through those files, this
 * moves them aside for the duration of the build and puts them back afterwards. The
 * exclusion is then one visible list rather than a dozen hidden branches.
 *
 * What survives is the whole reading product: the brief, market search, watch, deals,
 * explore, learn, insight detail with its evidence chain, coverage checks and Ask.
 * What does not is anything requiring a live server — which is the trade a file you can
 * email makes, and it is stated in the manifest the build writes.
 *
 *   npm run build:static
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const appDir = resolve(root, 'apps/web/src/app');
const srcDir = resolve(root, 'apps/web/src');
const stash = resolve(root, '.static-build-stash');

/** Routes that cannot exist without a server, and why. */
const EXCLUDED: { path: string; reason: string }[] = [
  { path: 'api', reason: 'route handlers need a server' },
  { path: 'login', reason: 'no sessions in a static build' },
  { path: 'signup', reason: 'no accounts in a static build' },
  { path: 'onboarding', reason: 'writes preferences through a server action' },
  { path: '(app)/profile/preferences', reason: 'writes preferences through a server action' },
  { path: '(app)/companion', reason: 'superseded by Ask, and needs the API route' },
  { path: '(app)/search', reason: 'reads a query string at request time' },
  { path: '(app)/coverage', reason: 'reads a query string at request time' },
  { path: '(app)/library/conversations', reason: 'conversations are written by the API' },
  { path: '(app)/prepare', reason: 'meeting briefs are written by a server action' },
];

/** Components that only exist to serve an excluded route. */
const EXCLUDED_COMPONENTS: { path: string; reason: string }[] = [
  { path: 'components/meeting-form.tsx', reason: 'only used by prepare' },
  { path: 'lib/preferences.ts', reason: 'server actions; only reachable from excluded pages' },
  { path: 'components/preference-form.tsx', reason: 'only used by set-up and preferences' },
];

/**
 * Server-action files, and the components that call them.
 *
 * Static exports do not support server actions at all — Next refuses to build rather
 * than degrading. Each of these components has a client-side twin in
 * `components/static-variants` with the same props and the same look, storing its state
 * in the browser instead. The build swaps them over so the interaction survives rather
 * than being stripped out.
 */
const ACTION_FILES = ['(app)/actions.ts', '(app)/learn/actions.ts', '(app)/prepare/actions.ts'];

const SWAPPED_COMPONENTS = ['brief-progress.tsx', 'feedback-bar.tsx', 'knowledge-check.tsx'];

// setup-gate.tsx is imported directly by the layout rather than swapped over an
// original, so it stays where it is.

/**
 * Pages whose only server action is sign-out.
 *
 * There is nothing to sign out of in a static build, so the action and its button are
 * removed rather than the whole page — the profile still shows who you are and what your
 * preferences are, which is most of why anyone opens it.
 */
const SIGN_OUT_PAGES = ['(app)/profile/page.tsx'];

/**
 * `force-dynamic` says "render this per request", which a static export has no way to
 * honour — Next refuses the build rather than quietly serving something stale.
 *
 * Every page carries it because the server build renders against a live database. For
 * the export they are flipped to `force-static`, which is what they in fact become: the
 * data is read once at build time and frozen into the output. Rewritten during the build
 * rather than in the source, so the server build keeps rendering per request.
 */
function makePagesStatic(): void {
  let changed = 0;
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (
        entry.name === 'page.tsx' ||
        entry.name === 'route.ts' ||
        entry.name === 'layout.tsx'
      ) {
        const before = readFileSync(full, 'utf8');
        if (!before.includes("dynamic = 'force-dynamic'")) continue;
        cpSync(
          full,
          resolve(stash, '__dynamic', full.slice(appDir.length + 1).replace(/\//g, '__')),
        );
        writeFileSync(
          full,
          before.replace(/dynamic = 'force-dynamic'/g, "dynamic = 'force-static'"),
        );
        changed += 1;
      }
    }
  };
  walk(appDir);
  console.log(`  rewrote   ${String(changed).padEnd(34)} pages from force-dynamic to force-static`);
}

function restoreDynamicPages(): void {
  const dir = resolve(stash, '__dynamic');
  if (!existsSync(dir)) return;
  for (const file of readdirSync(dir)) {
    cpSync(resolve(dir, file), resolve(appDir, file.replace(/__/g, '/')));
  }
}

function swapInStaticVariants(): void {
  for (const file of SWAPPED_COMPONENTS) {
    const original = resolve(srcDir, 'components', file);
    const variant = resolve(srcDir, 'components/static-variants', file);
    if (!existsSync(variant) || !existsSync(original)) continue;
    cpSync(original, resolve(stash, '__swapped', file));
    cpSync(variant, original);
    console.log(`  swapped   ${file.padEnd(34)} client-side variant`);
  }
}

function restoreSwappedComponents(): void {
  for (const file of SWAPPED_COMPONENTS) {
    const saved = resolve(stash, '__swapped', file);
    if (!existsSync(saved)) continue;
    cpSync(saved, resolve(srcDir, 'components', file));
  }
}

function stashExcluded(): void {
  rmSync(stash, { recursive: true, force: true });
  mkdirSync(stash, { recursive: true });
  mkdirSync(resolve(stash, '__swapped'), { recursive: true });
  mkdirSync(resolve(stash, '__signout'), { recursive: true });
  mkdirSync(resolve(stash, '__dynamic'), { recursive: true });

  for (const file of ACTION_FILES) {
    const from = resolve(appDir, file);
    if (!existsSync(from)) continue;
    const to = resolve(stash, '__actions', file);
    mkdirSync(resolve(to, '..'), { recursive: true });
    cpSync(from, to);
    rmSync(from, { force: true });
    console.log(`  excluded  ${file.padEnd(34)} server actions are unsupported`);
  }
  for (const { path, reason } of EXCLUDED_COMPONENTS) {
    const from = resolve(srcDir, path);
    if (!existsSync(from)) continue;
    const to = resolve(stash, '__components', path);
    mkdirSync(resolve(to, '..'), { recursive: true });
    cpSync(from, to, { recursive: true });
    rmSync(from, { recursive: true, force: true });
    console.log(`  excluded  ${path.padEnd(34)} ${reason}`);
  }
  for (const { path, reason } of EXCLUDED) {
    const from = resolve(appDir, path);
    if (!existsSync(from)) continue;
    const to = resolve(stash, path);
    mkdirSync(resolve(to, '..'), { recursive: true });
    cpSync(from, to, { recursive: true });
    rmSync(from, { recursive: true, force: true });
    console.log(`  excluded  ${path.padEnd(34)} ${reason}`);
  }
  swapInStaticVariants();
  stripSignOut();
  makePagesStatic();
}

function stripSignOut(): void {
  for (const file of SIGN_OUT_PAGES) {
    const target = resolve(appDir, file);
    if (!existsSync(target)) continue;
    cpSync(target, resolve(stash, '__signout', file.replace(/\//g, '__')));
    let source = readFileSync(target, 'utf8');
    source = source
      .replace(/async function signOutAction\(\)[\s\S]*?\n\}\n/, '')
      .replace(/<form action=\{signOutAction\}>[\s\S]*?<\/form>/g, '')
      .replace(/import \{ redirect \} from 'next\/navigation';\n/, '')
      .replace(/, signOut \}/, ' }')
      .replace(/\bsignOut,\s*/, '');
    writeFileSync(target, source);
    console.log(`  stripped  ${file.padEnd(34)} sign-out has nothing to sign out of`);
  }
}

function restoreExcluded(): void {
  restoreDynamicPages();
  restoreSwappedComponents();
  for (const file of SIGN_OUT_PAGES) {
    const saved = resolve(stash, '__signout', file.replace(/\//g, '__'));
    if (existsSync(saved)) cpSync(saved, resolve(appDir, file));
  }
  for (const file of ACTION_FILES) {
    const saved = resolve(stash, '__actions', file);
    if (!existsSync(saved)) continue;
    const to = resolve(appDir, file);
    mkdirSync(resolve(to, '..'), { recursive: true });
    cpSync(saved, to);
  }
  for (const { path } of EXCLUDED_COMPONENTS) {
    const from = resolve(stash, '__components', path);
    if (!existsSync(from)) continue;
    const to = resolve(srcDir, path);
    mkdirSync(resolve(to, '..'), { recursive: true });
    cpSync(from, to, { recursive: true });
  }
  for (const { path } of EXCLUDED) {
    const from = resolve(stash, path);
    if (!existsSync(from)) continue;
    const to = resolve(appDir, path);
    mkdirSync(resolve(to, '..'), { recursive: true });
    cpSync(from, to, { recursive: true });
  }
  rmSync(stash, { recursive: true, force: true });
}

console.log('\n  Building the static site\n');

// The palette's lists are identical on every page, so they ship as one fetched file
// rather than being serialised into all 831 of them.
execSync('npm run build:palette', { cwd: root, stdio: 'inherit' });

// Ask retrieves in the browser here, so the claim corpus ships with the site.
execSync('npm run build:evidence', { cwd: root, stdio: 'inherit' });

// The brief's candidate pool, so Today can be composed in the browser from the reader's
// own answers rather than served as the one the build machine composed for nobody.
execSync('npm run build:brief-pool', { cwd: root, stdio: 'inherit' });

stashExcluded();

try {
  execSync('npm run build --workspace=@mios/web', {
    cwd: root,
    stdio: 'inherit',
    /*
     * The same fact twice, because server and client code cannot read the same variable.
     * STATIC_EXPORT is a server-only env var; Next inlines NEXT_PUBLIC_* into the browser
     * bundle, which is how a client component knows not to link at a route the export
     * does not contain.
     */
    env: {
      ...process.env,
      STATIC_EXPORT: '1',
      NEXT_PUBLIC_STATIC_EXPORT: '1',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  });

  const out = resolve(root, 'apps/web/out');

  /*
   * Without this, GitHub Pages runs the output through Jekyll, which ignores every
   * directory beginning with an underscore — including `_next`, where all the JavaScript
   * and CSS live. The result is a site that serves unstyled HTML and looks like a broken
   * build.
   */
  writeFileSync(resolve(out, '.nojekyll'), '');

  writeFileSync(
    resolve(out, 'BUILD.txt'),
    [
      `NORTH — static build`,
      `generated ${new Date().toISOString()}`,
      ``,
      `This is a snapshot. The data is as of the moment it was built; nothing in it`,
      `updates by itself.`,
      ``,
      `Not included, because a static site has no server:`,
      ...EXCLUDED.map((e) => `  - ${e.path} (${e.reason})`),
      ``,
    ].join('\n'),
  );
  console.log('\n  Static site written to apps/web/out\n');
} finally {
  // Always restore, including after a failed build — otherwise a broken export leaves
  // the repository missing a third of its routes.
  restoreExcluded();
  console.log('  Excluded routes restored.\n');
}
