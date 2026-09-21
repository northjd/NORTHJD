/**
 * The easter-egg panel must not inherit its surroundings.
 *
 * `MakersMark` is mounted in three places, and one of them — the app-shell footer that
 * appears on every page — sets `whitespace-nowrap`. `white-space` inherits, so a panel
 * rendered in place had every paragraph on one unwrapped line running out of the card.
 * The set-up gate is a different trap: `fixed inset-0 z-[95]` containing a
 * `relative z-10` footer, so a panel rendered in place sits two stacking contexts deep.
 *
 * Both are cured by portalling to `document.body`. This reads the source rather than
 * rendering, because the failure is about *where in the DOM* the panel is and which
 * classes its ancestors carry — neither of which a shallow render would show.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

const component = read('apps/web/src/components/makers-mark.tsx');

describe('the maker’s mark panel', () => {
  it('is portalled to the body rather than rendered where it is mounted', () => {
    expect(component).toContain('createPortal');
    expect(component).toContain('document.body');
  });

  it('sits above every other layer in the product', () => {
    const panel = component.match(/className="fixed inset-0 z-\[(\d+)\]/);
    expect(panel, 'the panel should still be a full-screen fixed layer').toBeTruthy();
    const panelZ = Number(panel![1]);

    // Every other z-index the app uses. The panel is opened deliberately by the reader,
    // so nothing should be in front of it — least of all the set-up gate, which is the
    // screen the monogram is most visible on.
    const others = [
      'apps/web/src/components/static-variants/setup-gate.tsx',
      'apps/web/src/components/command-palette.tsx',
      'apps/web/src/components/feedback-widget.tsx',
      'apps/web/src/components/static-variants/feedback-widget.tsx',
    ].flatMap((file) => [...read(file).matchAll(/z-\[(\d+)\]/g)].map((m) => Number(m[1])));

    expect(others.length).toBeGreaterThan(0);
    expect(panelZ).toBeGreaterThan(Math.max(...others));
  });

  it('waits for the client before portalling, since the server has no document', () => {
    expect(component).toMatch(/found && mounted/);
  });
});
