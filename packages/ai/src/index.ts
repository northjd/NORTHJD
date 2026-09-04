/**
 * AI service layer entry point.
 *
 * `getTextProvider()` returns null when no model is configured. Callers must handle
 * null by using the extractive path in `@mios/intelligence` — they must never
 * substitute prose of their own. This is what makes the product usable with zero
 * credentials while remaining honest about what produced each output.
 */

import { config } from '@mios/config';
import { AnthropicProvider } from './anthropic';
import type { TextProvider } from './types';

export * from './types';
export * from './voice';
export { AnthropicProvider };

let cached: TextProvider | null | undefined;

export function getTextProvider(): TextProvider | null {
  if (cached !== undefined) return cached;
  const env = config();
  if (env.AI_PROVIDER === 'anthropic') {
    const provider = new AnthropicProvider();
    cached = provider.available ? provider : null;
  } else {
    cached = null;
  }
  return cached;
}

export function resetProviderCacheForTests(): void {
  cached = undefined;
}

/** One line for the UI: what is generating content right now, and what that means. */
export function generationMode(): {
  generator: 'llm' | 'deterministic_extractive';
  label: string;
  detail: string;
} {
  const provider = getTextProvider();
  if (provider) {
    return {
      generator: 'llm',
      label: `Model-assisted (${provider.model})`,
      detail:
        'Summaries and answers are model-generated, then schema-validated and checked against stored evidence before display. Statements that cannot be traced to an evidence span are discarded.',
    };
  }
  return {
    generator: 'deterministic_extractive',
    label: 'Extractive (no language model configured)',
    detail:
      'No model is configured, so nothing is paraphrased or invented. Summaries reuse sentences exactly as they appear in the stored sources, classifications come from rules, and the structural sections are assembled from the data model.',
  };
}
