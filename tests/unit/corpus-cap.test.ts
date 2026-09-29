/**
 * The document cap, and the loop it was silently failing to close.
 *
 * The arithmetic here was never wrong. What was wrong was that its answer was thrown
 * away: the cap was derived after the build, the corpus was deleted down to it, and the
 * next run's pre-build prune started from the configured ceiling again because nothing
 * had written the derived figure anywhere that survived the job.
 *
 * The symptom was not a failure. Every run was green. The corpus simply sat at exactly
 * the ceiling, the export was over budget on every build, and the oldest document kept
 * moving forward — three months of archive lost in six days to a correction that was
 * being computed and discarded. So the convergence test below matters more than the
 * boundary ones: it is the property the fix claims, and it only holds if each run
 * actually starts from what the last one worked out.
 */

import { describe, expect, it } from 'vitest';
import { capForTarget, rememberedCap } from '../../scripts/lib/corpus-cap';

const CEILING = 2200;
const TARGET = 700;

describe('capForTarget', () => {
  it('lowers the cap when the build came in over target', () => {
    // The figures measured live on 2026-09-28.
    expect(
      capForTarget({ totalMb: 748.9, documents: 2200, targetMb: TARGET, ceiling: CEILING }),
    ).toBe(1850);
  });

  it('never rises above the configured ceiling, however light the build', () => {
    expect(capForTarget({ totalMb: 40, documents: 2200, targetMb: TARGET, ceiling: CEILING })).toBe(
      CEILING,
    );
  });

  it('rises again when the site gets lighter, which is what makes it not a ratchet', () => {
    const heavy = capForTarget({
      totalMb: 748.9,
      documents: 2200,
      targetMb: TARGET,
      ceiling: CEILING,
    })!;
    // Same corpus, a fifth of the page weight gone — the 15.7 MB of duplicated layout
    // payload is the standing candidate.
    const lighter = capForTarget({
      totalMb: 600,
      documents: 2200,
      targetMb: TARGET,
      ceiling: CEILING,
    })!;
    expect(lighter).toBeGreaterThan(heavy);
  });

  it('refuses to derive anything from a measurement it does not have', () => {
    expect(
      capForTarget({ totalMb: 0, documents: 2200, targetMb: TARGET, ceiling: CEILING }),
    ).toBeNull();
    expect(
      capForTarget({ totalMb: 748.9, documents: 0, targetMb: TARGET, ceiling: CEILING }),
    ).toBeNull();
    expect(
      capForTarget({ totalMb: 748.9, documents: 2200, targetMb: Number.NaN, ceiling: CEILING }),
    ).toBeNull();
  });

  /*
   * The export is a fixed part that does not depend on the corpus — company pages, JS
   * chunks, the palette — plus a marginal cost per document. Solving the iteration
   *
   *     n' = 0.9 · target · n / (fixed + perDocument · n)
   *
   * gives a single fixed point where the export weighs 0.9 × target exactly. This is the
   * reason the cap does not need to be estimated by hand again: hand-estimating it from
   * one measurement is what put 3,500 in the config and froze the site for two days.
   */
  it('converges on a corpus whose export weighs nine tenths of the target', () => {
    const fixed = 180;
    const perDocument = 0.258;
    const weigh = (n: number) => fixed + perDocument * n;

    let n = CEILING;
    const seen: number[] = [];
    for (let run = 0; run < 40; run += 1) {
      seen.push(n);
      n = capForTarget({ totalMb: weigh(n), documents: n, targetMb: TARGET, ceiling: CEILING })!;
    }

    expect(weigh(n)).toBeCloseTo(0.9 * TARGET, 0);
    // It settles rather than oscillating, and it approaches from above — it must never
    // grow the corpus into a build it has not proved it can publish.
    for (let i = 1; i < seen.length; i += 1) expect(seen[i]!).toBeLessThanOrEqual(seen[i - 1]!);
    expect(seen.at(-1)).toBe(seen.at(-2));
  });

  it('reaches that state in a handful of runs, not a month of them', () => {
    const weigh = (n: number) => 180 + 0.258 * n;
    let n = CEILING;
    let runs = 0;
    while (weigh(n) > 0.9 * TARGET + 1 && runs < 100) {
      n = capForTarget({ totalMb: weigh(n), documents: n, targetMb: TARGET, ceiling: CEILING })!;
      runs += 1;
    }
    // GitHub fires the cron four to six times a day, so this is inside a day.
    expect(runs).toBeLessThanOrEqual(4);
  });
});

describe('rememberedCap', () => {
  it('reads back what the last run wrote', () => {
    const note = rememberedCap({
      cap: 1850,
      totalMb: 748.9,
      documents: 2200,
      at: '2026-09-28T13:55:05Z',
    });
    expect(note).toMatchObject({ cap: 1850, documents: 2200 });
  });

  /*
   * A cap file that cannot be trusted has to fall back to the configured ceiling, not to
   * zero. Reading a corrupt file as "keep 0 documents" would delete the archive in one
   * run and every run afterwards would look healthy.
   */
  it('rejects anything that would delete the archive', () => {
    expect(rememberedCap({ cap: 0 })).toBeNull();
    expect(rememberedCap({ cap: -1 })).toBeNull();
    expect(rememberedCap({ cap: Number.NaN })).toBeNull();
    expect(rememberedCap({ documents: 2200 })).toBeNull();
    expect(rememberedCap('1850')).toBeNull();
    expect(rememberedCap(null)).toBeNull();
  });
});
