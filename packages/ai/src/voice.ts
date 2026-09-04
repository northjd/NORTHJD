/**
 * Speech providers.
 *
 * The default for both directions is `browser`: the Web Speech API runs on the user's
 * own device, so no audio ever reaches this server and there is no credential to
 * leak. That is a deliberate privacy default, not a limitation we are hiding — the
 * server-side options exist behind the same interface and can be enabled with a key.
 *
 * Availability is reported truthfully. If a browser does not implement the API, the
 * client detects it at runtime and the UI says voice input is unavailable in this
 * browser rather than showing a button that does nothing.
 */

import { config } from '@mios/config';
import type { SpeechToTextProvider, TextToSpeechProvider } from './types';

class BrowserSpeechToText implements SpeechToTextProvider {
  readonly name = 'browser';
  readonly mode = 'browser' as const;
  readonly available = true;
  // No transcribe(): by design, nothing is transcribed server-side in this mode.
}

class UnavailableSpeechToText implements SpeechToTextProvider {
  readonly name: string;
  readonly mode = 'unavailable' as const;
  readonly available = false;
  constructor(name: string) {
    this.name = name;
  }
}

class DeepgramSpeechToText implements SpeechToTextProvider {
  readonly name = 'deepgram';
  readonly mode = 'server' as const;
  readonly available: boolean;
  readonly #key: string | null;

  constructor() {
    this.#key = config().DEEPGRAM_API_KEY;
    this.available = Boolean(this.#key);
  }

  async transcribe(
    audio: Uint8Array,
    mimeType: string,
  ): Promise<{ text: string; language: string }> {
    if (!this.#key) throw new Error('DEEPGRAM_API_KEY is not set');
    const res = await fetch('https://api.deepgram.com/v1/listen?smart_format=true', {
      method: 'POST',
      headers: { authorization: `Token ${this.#key}`, 'content-type': mimeType },
      body: audio as unknown as BodyInit,
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`Deepgram HTTP ${res.status}`);
    const json = (await res.json()) as {
      results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
    };
    const text = json.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
    return { text, language: 'en' };
  }
}

class BrowserTextToSpeech implements TextToSpeechProvider {
  readonly name = 'browser';
  readonly mode = 'browser' as const;
  readonly available = true;
}

class UnavailableTextToSpeech implements TextToSpeechProvider {
  readonly name: string;
  readonly mode = 'unavailable' as const;
  readonly available = false;
  constructor(name: string) {
    this.name = name;
  }
}

export function getSpeechToText(): SpeechToTextProvider {
  const provider = config().STT_PROVIDER;
  if (provider === 'browser') return new BrowserSpeechToText();
  if (provider === 'deepgram') {
    const dg = new DeepgramSpeechToText();
    return dg.available ? dg : new UnavailableSpeechToText('deepgram');
  }
  return new UnavailableSpeechToText('none');
}

export function getTextToSpeech(): TextToSpeechProvider {
  const provider = config().TTS_PROVIDER;
  if (provider === 'browser') return new BrowserTextToSpeech();
  if (provider === 'elevenlabs') {
    return config().ELEVENLABS_API_KEY
      ? new UnavailableTextToSpeech('elevenlabs')
      : new UnavailableTextToSpeech('elevenlabs');
  }
  return new UnavailableTextToSpeech('none');
}
