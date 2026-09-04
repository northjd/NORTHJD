/**
 * Resolves a path against the deployment's base path.
 *
 * GitHub Pages serves a project site from `/<repo>`, so an absolute `fetch('/x.json')`
 * asks for `/x.json` and gets the 404 page. Next rewrites `<Link>` and its own assets
 * automatically; it does not touch strings passed to `fetch`, which is why this failure
 * shows up only after deploying and only on the features that fetch — everything else
 * looks perfect.
 *
 * The base path is not available to client code at runtime, so it is read from the
 * document's own asset URLs: Next has already rewritten those, and they carry the answer.
 */
export function assetPath(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (typeof document === 'undefined') return clean;

  // Any script Next emitted points at <base>/_next/…; the part before it is the prefix.
  const script = document.querySelector<HTMLScriptElement>('script[src*="/_next/"]');
  const href = script?.getAttribute('src') ?? '';
  const index = href.indexOf('/_next/');
  const base = index > 0 ? href.slice(0, index) : '';

  return `${base}${clean}`;
}
