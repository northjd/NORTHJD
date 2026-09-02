import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const pkg = (name: string, entry = 'index.ts') =>
  resolve(import.meta.dirname, `packages/${name}/src/${entry}`);

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
    globals: false,
    // The integration tests talk to the local PGlite backend, which serves one
    // connection. Running files in parallel would have them fight over it.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@mios/domain': pkg('domain'),
      '@mios/database': pkg('database'),
      '@mios/connectors': pkg('connectors'),
      '@mios/intelligence': pkg('intelligence'),
      '@mios/ai': pkg('ai'),
      '@mios/search': pkg('search'),
      '@mios/ranking': pkg('ranking'),
      '@mios/learning': pkg('learning'),
      '@mios/evaluation': pkg('evaluation'),
      '@mios/config': pkg('config'),
      '@mios/ui': pkg('ui', 'index.tsx'),
    },
  },
});
