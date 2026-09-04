import { requireUser } from '@/lib/session';
import { AskPanel } from '@/components/ask-panel';
import { InterpretationBlock } from '@mios/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ask' };

/**
 * Ask — NORTH finds the evidence, your Claude does the reasoning.
 *
 * This replaced a Companion that tried to answer questions itself. With no language
 * model configured it could only return sentences already in the corpus, so an "ask
 * anything" box became a slower search that mostly refused — worse than no box, because
 * it promised reasoning it could not do.
 *
 * The split here is not a workaround. Retrieval over an evidenced corpus is the hard,
 * checkable half and the half a model is worst at; phrasing is the half it is best at.
 * Handing over a closed set of sourced claims plays to both, costs nothing, needs no API
 * key, and keeps the evidence guarantee intact across the handoff.
 */
export default async function AskPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser();
  const { q } = await searchParams;

  return (
    <div className="mx-auto max-w-[820px]">
      <p className="t-eyebrow">Ask</p>
      <h1 className="mt-2 text-[27px] font-semibold leading-[1.16] tracking-[-0.028em]">
        Find the evidence, then think it through
      </h1>
      <p className="mt-3 max-w-[64ch] text-[14px] leading-[1.68] text-[var(--text-muted)]">
        Ask a question and NORTH finds every claim in the monitored sources that bears on it — with
        dates, sources and how strong each one is. Copy the prompt into your own Claude and reason
        over it there.
      </p>

      <div className="mt-8">
        <AskPanel initialQuestion={q ?? ''} />
      </div>

      <div className="mt-10">
        <InterpretationBlock label="Why it works this way">
          <p>
            NORTH does not run a language model, and this is the better arrangement rather than a
            limitation it is working around. Retrieval over a curated, cited corpus is what makes an
            answer checkable, and it is exactly what a model cannot do for itself — it has no way of
            knowing whether it has any evidence. Phrasing is what models are good at. So NORTH
            assembles the evidence and your Claude reasons over it, which costs nothing, needs no
            API key, and means the answer is grounded in sources you can open rather than in
            something recalled.
          </p>
        </InterpretationBlock>
      </div>
    </div>
  );
}
