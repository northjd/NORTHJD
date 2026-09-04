/**
 * Whether this bundle is the static export, readable from the browser.
 *
 * `IS_STATIC_EXPORT` in lib/session is server-only: `process.env.STATIC_EXPORT` does not
 * survive into the client bundle, so a client component asking it always got `false` and
 * happily rendered links to routes the export leaves out. Next inlines `NEXT_PUBLIC_*` at
 * build time, which is the one form both halves can see.
 *
 * Used to suppress links, never to change what a page claims. A fact that depends on
 * which build you are looking at would not be a fact.
 */
export const IS_STATIC_BUILD = process.env.NEXT_PUBLIC_STATIC_EXPORT === '1';
