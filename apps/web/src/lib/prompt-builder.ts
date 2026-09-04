import type { RetrievedClaim } from '@mios/intelligence';

/**
 * Turning retrieved evidence into a prompt someone can paste into their own Claude.
 *
 * The division of labour is the point. NORTH does retrieval — finding the claims that
 * bear on a question, with their sources, dates, perspectives and evidence strength —
 * which is the hard part and the part that makes an answer checkable. Language models
 * are good at reasoning over material and bad at knowing whether they have any; handing
 * one a closed set of sourced claims plays to the first and removes the second.
 *
 * It also costs nothing and needs no API key: everyone already has Claude. And because
 * the prompt carries only sourced claims with their citations, the honesty guarantee
 * survives the handoff — the model is reasoning over evidence rather than from memory,
 * and the instructions tell it to say so when the evidence runs out.
 */

export interface PromptEvidence {
  index: number;
  text: string;
  claimType: string;
  evidenceStrength: string;
  sourceName: string;
  perspective: string;
  documentTitle: string;
  documentUrl: string;
  publishedAt: string | null;
  isFirstParty: boolean;
}

export interface BuiltPrompt {
  question: string;
  evidence: PromptEvidence[];
  /** The complete text to paste. */
  text: string;
  /** True when retrieval found nothing worth handing over. */
  empty: boolean;
}

const MODE_INSTRUCTION: Record<string, string> = {
  explore: 'Answer the question from the evidence below.',
  brief:
    'Give me a short brief: what changed, why it matters, and what I should watch. Keep it under 200 words.',
  prepare:
    'Prepare me for a conversation about this. Give me: what changed, what is actually evidenced versus inferred, five specific questions worth asking, and one contrarian angle.',
  challenge:
    'Challenge the premise of my question using the evidence below. Where the evidence contradicts it, say so. Where it neither supports nor contradicts, say that too.',
  explain:
    'Explain the underlying mechanics so I understand how this market works, not just what happened.',
};

export function buildPrompt(
  question: string,
  claims: RetrievedClaim[],
  mode: keyof typeof MODE_INSTRUCTION = 'explore',
): BuiltPrompt {
  const evidence: PromptEvidence[] = claims.map((c, i) => ({
    index: i + 1,
    text: c.text,
    claimType: c.claimType,
    evidenceStrength: c.evidenceStrength,
    sourceName: c.sourceName,
    perspective: c.perspective,
    documentTitle: c.documentTitle,
    documentUrl: c.documentUrl,
    publishedAt: c.publishedAt ? new Date(c.publishedAt).toISOString().slice(0, 10) : null,
    isFirstParty: String(c.perspective).startsWith('FIRST_PARTY'),
  }));

  if (evidence.length === 0) {
    return {
      question,
      evidence,
      empty: true,
      text: '',
    };
  }

  const lines: string[] = [];

  lines.push('You are helping me think about a market question.');
  lines.push('');
  lines.push(
    'Below is every piece of evidence my market-intelligence tool holds on this. It was',
  );
  lines.push(
    'retrieved from monitored public sources, and each item carries its source, date and',
  );
  lines.push('how strong that evidence is.');
  lines.push('');
  lines.push('## Rules');
  lines.push('');
  lines.push('- Reason only from the evidence below. Do not add facts from your own knowledge.');
  lines.push('- Cite the numbered item behind every factual claim, like [3].');
  lines.push(
    '- Separate what the evidence establishes from what you are inferring. Label inference as inference.',
  );
  lines.push(
    '- Items marked SELF-REPORTED come from the company being described. Treat them as claims, not findings.',
  );
  lines.push(
    '- If the evidence does not answer the question, say so plainly and say what is missing. Do not fill the gap.',
  );
  lines.push('');
  lines.push('## My question');
  lines.push('');
  lines.push(question.trim());
  lines.push('');
  lines.push(MODE_INSTRUCTION[mode] ?? MODE_INSTRUCTION.explore!);
  lines.push('');
  lines.push(`## Evidence (${evidence.length} items)`);
  lines.push('');

  for (const e of evidence) {
    const flags = [
      e.claimType !== 'FACT' ? e.claimType : null,
      e.isFirstParty ? 'SELF-REPORTED' : null,
    ].filter(Boolean);

    lines.push(`[${e.index}] ${e.text}`);
    lines.push(
      `    — ${e.sourceName}${e.publishedAt ? `, ${e.publishedAt}` : ''}` +
        `${flags.length ? ` · ${flags.join(' · ')}` : ''}`,
    );
    lines.push(`    ${e.documentUrl}`);
    lines.push('');
  }

  lines.push('---');
  lines.push(
    'Evidence assembled by NORTH. Nothing above was written by a language model — each',
  );
  lines.push('item is a sentence from a monitored source.');

  return { question, evidence, empty: false, text: lines.join('\n') };
}
