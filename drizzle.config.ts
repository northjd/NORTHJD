import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './packages/database/src/schema/index.ts',
  out: './packages/database/migrations',
  dialect: 'postgresql',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:55432/postgres',
  },
  verbose: true,
  strict: false,
});
