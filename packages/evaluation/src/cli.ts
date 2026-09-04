import { closeDb, pingDb } from '@mios/database';
import { runEvaluation } from './index';

const ping = await pingDb();
if (!ping.ok) {
  console.error(
    `\n  Cannot reach the database.\n  ${ping.error}\n  Start it with:  npm run db:up\n`,
  );
  process.exit(1);
}

const run = await runEvaluation();

console.log(`\n  Evaluation — ${run.passed}/${run.total} passed\n`);
let suite = '';
for (const c of run.cases) {
  if (c.suite !== suite) {
    suite = c.suite;
    console.log(`  ${suite.replace(/_/g, ' ')}`);
  }
  console.log(`    ${c.passed ? '✓' : '✗'} ${c.name}`);
  if (!c.passed) console.log(`      ${c.detail}`);
}
console.log('');

await closeDb();
process.exit(run.passed === run.total ? 0 : 1);
