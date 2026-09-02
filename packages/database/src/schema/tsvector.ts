/**
 * A `tsvector` column type for drizzle.
 *
 * The search columns are PostgreSQL generated columns created by
 * `sql/001_search.sql`. Declaring them here lets queries reference
 * `table.searchVector` with types.
 *
 * Caveat for anyone running `npm run db:generate`: drizzle-kit does not model
 * generated columns, so it will want to emit a plain `ADD COLUMN search_vector
 * tsvector` for each of these. Delete those lines from the generated migration — the
 * columns are owned by `sql/001_search.sql`, which runs after every migration and is
 * idempotent.
 */

import { customType } from 'drizzle-orm/pg-core';

export const tsvector = customType<{ data: string; driverData: string; notNull: false }>({
  dataType() {
    return 'tsvector';
  },
});
