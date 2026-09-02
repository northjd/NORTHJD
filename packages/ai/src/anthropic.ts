/**
 * Anthropic Messages API provider.
 *
 * Uses tool-use for constrained output: the model must call a single tool whose input
 * schema is the JSON Schema we require, which is far more reliable than asking for
 * JSON in prose. The result is still validated with Zod — a tool call is a strong hint,
 * not a guarantee — and a schema failure is retried once with the validation errors
 * fed back, then given up on. Giving up is correct: the caller falls back to the
 * extractive generator rather than shipping unvalidated text.
 */

import { config } from '@mios/config';
import {
  AiUnavailableError,
  SchemaValidationError,
  type GenerationResult,
  type StructuredRequest,
  type TextProvider,
} from './types';

interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}
interface AnthropicTextBlock {
  type: 'text';
  text: string;
}
interface AnthropicResponse {
  content: (AnthropicToolUseBlock | AnthropicTextBlock)[];
  usage?: { input_tokens?: number; output_tokens?: number };
  model?: string;
}

/**
 * USD per million tokens. Used for the run budget and the admin cost view. Update
 * alongside published pricing; an out-of-date figure only affects reporting, never
 * correctness.
 */
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
};

function priceFor(model: string): { input: number; output: number } {
  for (const [key, value] of Object.entries(PRICING)) {
    if (model.startsWith(key)) return value;
  }
  return { input: 3, output: 15 };
}

export class AnthropicProvider implements TextProvider {
  readonly name = 'anthropic';
  readonly model: string;
  readonly available: boolean;
  readonly #apiKey: string | null;
  readonly #baseUrl: string;

  constructor() {
    const env = config();
    this.model = env.AI_MODEL;
    this.#apiKey = env.ANTHROPIC_API_KEY;
    this.#baseUrl = env.ANTHROPIC_BASE_URL.replace(/\/$/, '');
    this.available = Boolean(this.#apiKey);
  }

  async generateStructured<T>(req: StructuredRequest<T>): Promise<GenerationResult<T>> {
    if (!this.#apiKey) throw new AiUnavailableError('ANTHROPIC_API_KEY is not set');

    const toolName = 'emit_result';
    const body = {
      model: this.model,
      max_tokens: req.maxOutputTokens ?? config().AI_MAX_OUTPUT_TOKENS,
      temperature: req.temperature ?? 0,
      system: req.system,
      tools: [
        {
          name: toolName,
          description: 'Return the structured result. This is the only permitted output.',
          input_schema: req.jsonSchema,
        },
      ],
      tool_choice: { type: 'tool', name: toolName },
      messages: [{ role: 'user' as const, content: req.prompt }],
    };

    let lastError: unknown = null;
    let lastRaw = '';
    let inputTokens = 0;
    let outputTokens = 0;

    for (let attempt = 0; attempt <= 1; attempt++) {
      const messages =
        attempt === 0
          ? body.messages
          : [
              ...body.messages,
              {
                role: 'assistant' as const,
                content: `Previous attempt: ${lastRaw.slice(0, 2000)}`,
              },
              {
                role: 'user' as const,
                content: `That output failed validation: ${JSON.stringify(lastError).slice(0, 1500)}. Return a corrected result via the ${toolName} tool. Do not invent facts to satisfy the schema — omit optional fields instead.`,
              },
            ];

      const res = await fetch(`${this.#baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.#apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ ...body, messages }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new AiUnavailableError(`HTTP ${res.status}: ${text.slice(0, 400)}`);
      }

      const json = (await res.json()) as AnthropicResponse;
      inputTokens += json.usage?.input_tokens ?? 0;
      outputTokens += json.usage?.output_tokens ?? 0;

      const toolUse = json.content.find(
        (b): b is AnthropicToolUseBlock => b.type === 'tool_use' && b.name === toolName,
      );
      lastRaw = toolUse ? JSON.stringify(toolUse.input) : JSON.stringify(json.content);

      if (!toolUse) {
        lastError = 'model did not call the required tool';
        continue;
      }

      const parsed = req.schema.safeParse(toolUse.input);
      if (parsed.success) {
        const price = priceFor(this.model);
        return {
          value: parsed.data,
          generator: 'llm',
          model: this.model,
          retries: attempt,
          usage: {
            inputTokens,
            outputTokens,
            costUsd:
              (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output,
          },
        };
      }
      lastError = parsed.error.issues;
    }

    throw new SchemaValidationError(
      `Model output failed schema validation for "${req.purpose}" after a retry`,
      lastError,
      lastRaw,
    );
  }
}
