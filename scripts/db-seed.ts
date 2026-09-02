import { closeDb, pingDb } from '@mios/database';
import { seed } from '@mios/database/seed/index';

const ping = await pingDb();
if (!ping.ok) {
  console.error(`\n  Cannot reach the database.\n  ${ping.error}\n  Start it with:  npm run db:up\n`);
  process.exit(1);
}

const result = await seed();

console.log(`
  Seeded.

  Workspace   ${result.workspaceId}
  Sign in     ${result.demoEmail}
              ${result.demoPassword}

  Reference content (taxonomy, learning units, entities, source registry) is loaded.
  No events or insights exist yet — run the pipeline to create them:

      npm run pipeline
`);

await closeDb();
