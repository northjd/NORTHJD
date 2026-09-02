'use client';

import { useEffect, useRef, useState } from 'react';
import type { CompanionMode, CompanionResponse, DepthLevel, ResponseLength } from '@mios/domain';

/**
 * The Companion surface.
 *
 * Text and voice both go through `/api/companion`, and the rendered answer is a view
 * of one `CompanionResponse`: facts with citations, interpretations and hypotheses
 * under their own headings, unknowns stated. Speech reads `response.voice` — derived
 * from the same object, so it cannot say anything the text does not.
 */

const MODES: { mode: CompanionMode; label: string; hint: string; placeholder: string }[] = [
  { mode: 'brief_me', label: 'Brief me', hint: 'A time-boxed update', placeholder: 'Brief me on what changed since yesterday' },
  { mode: 'explain_it', label: 'Explain it', hint: 'Fundamentals and mechanics', placeholder: 'How do fashion retailers make money?' },
  { mode: 'explore_it', label: 'Explore it', hint: 'Evidence-grounded research', placeholder: 'Which companies are scaling AI beyond pilots?' },
  { mode: 'prepare_me', label: 'Prepare me', hint: 'For a specific conversation', placeholder: 'Prepare me for a discussion with a fashion retail COO' },
  { mode: 'challenge_me', label: 'Challenge me', hint: 'Counter-arguments and weak assumptions', placeholder: 'Challenge the idea that AI allocation reduces markdown' },
  { mode: 'teach_me', label: 'Teach me', hint: 'Structured learning', placeholder: 'Teach me the economics of fashion retail' },
  { mode: 'capture_reflect', label: 'Capture', hint: 'Save a thought as your own note', placeholder: 'My view: the constraint is decision rights, not models' },
];

const LENGTHS: { value: ResponseLength; label: string }[] = [
  { value: 'one_sentence', label: 'One sentence' },
  { value: 'thirty_seconds', label: '30 seconds' },
  { value: 'sixty_second_brief', label: '60-second brief' },
  { value: 'executive_summary', label: 'Executive summary' },
  { value: 'standard', label: 'Standard' },
  { value: 'deep_dive', label: 'Deep dive' },
];

const DEPTHS: DepthLevel[] = ['foundation', 'executive', 'expert'];

interface Turn {
  role: 'user' | 'assistant';
  text: string;
  response?: CompanionResponse;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export function CompanionPanel({
  pageContext,
  initialQuestion,
  compact = false,
}: {
  pageContext?: { kind: string; id: string | null; label: string | null };
  initialQuestion?: string;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<CompanionMode>('explore_it');
  const [depth, setDepth] = useState<DepthLevel>('executive');
  const [length, setLength] = useState<ResponseLength>('standard');
  const [question, setQuestion] = useState(initialQuestion ?? '');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);

  // Availability is detected, never assumed. If the browser lacks the API the control
  // says so rather than appearing and failing.
  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Impl = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Impl) return;
    const instance = new Impl();
    instance.continuous = false;
    instance.interimResults = false;
    instance.lang = 'en-GB';
    recognition.current = instance;
    setVoiceSupported(true);
  }, []);

  const ask = async (text: string, inputMode: 'text' | 'voice') => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setError(null);
    setTurns((prev) => [...prev, { role: 'user', text: trimmed }]);
    setQuestion('');

    try {
      const res = await fetch('/api/companion', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          mode,
          depth,
          length,
          conversationId,
          pageContext: pageContext ?? null,
          selectedEntityIds: [],
          inputMode,
        }),
      });

      const payload = (await res.json()) as
        | { conversationId: string; response: CompanionResponse }
        | { error: string };

      if (!res.ok || 'error' in payload) {
        setError('error' in payload ? payload.error : 'The Companion could not answer that.');
        return;
      }

      setConversationId(payload.conversationId);
      setTurns((prev) => [
        ...prev,
        { role: 'assistant', text: payload.response.directAnswer, response: payload.response },
      ]);

      if (inputMode === 'voice') speak(payload.response.voice.spokenSummary);
    } catch {
      setError('Network error. The Companion did not answer.');
    } finally {
      setBusy(false);
    }
  };

  const startListening = () => {
    const instance = recognition.current;
    if (!instance) return;
    setListening(true);
    instance.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      setListening(false);
      if (transcript) void ask(transcript, 'voice');
    };
    instance.onerror = () => {
      setListening(false);
      setError('Voice input failed. Check microphone permission, or type instead.');
    };
    instance.onend = () => setListening(false);
    instance.start();
  };

  const speak = (text: string) => {
    if (!('speechSynthesis' in window) || !text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    utterance.onend = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  };

  const activeMode = MODES.find((m) => m.mode === mode)!;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {MODES.map((m) => (
          <button
            key={m.mode}
            type="button"
            title={m.hint}
            onClick={() => setMode(m.mode)}
            className={`rounded border px-2.5 py-1 text-[12px] font-medium transition-colors ${
              mode === m.mode
                ? 'border-transparent bg-[var(--accent)] text-white'
                : 'border-[var(--border)] hover:bg-[var(--surface-inset)]'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <label className="flex items-center gap-1.5">
          <span className="text-[var(--text-subtle)]">Length</span>
          <select
            value={length}
            onChange={(e) => setLength(e.target.value as ResponseLength)}
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1"
          >
            {LENGTHS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-[var(--text-subtle)]">Depth</span>
          <select
            value={depth}
            onChange={(e) => setDepth(e.target.value as DepthLevel)}
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1"
          >
            {DEPTHS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        {pageContext ? (
          <span className="rounded bg-[var(--surface-inset)] px-2 py-1 text-[var(--text-subtle)]">
            Context: {pageContext.label ?? pageContext.kind}
          </span>
        ) : null}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question, 'text');
        }}
        className="flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={activeMode.placeholder}
          aria-label="Ask the Companion"
          className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px]"
        />
        {voiceSupported ? (
          <button
            type="button"
            onClick={startListening}
            disabled={busy || listening}
            title="Speak your question. Transcription happens in your browser; no audio is sent to the server."
            className={`rounded border px-3 py-2 text-[13px] font-medium ${
              listening ? 'border-transparent bg-alert-500 text-white' : 'border-[var(--border)]'
            }`}
          >
            {listening ? 'Listening…' : 'Speak'}
          </button>
        ) : null}
        <button
          type="submit"
          disabled={busy || question.trim().length === 0}
          className="rounded bg-[var(--accent)] px-3 py-2 text-[13px] font-medium text-white disabled:opacity-60"
        >
          {busy ? 'Thinking…' : 'Ask'}
        </button>
      </form>

      {!voiceSupported ? (
        <p className="text-[12px] text-[var(--text-subtle)]">
          Voice input is not available in this browser. The Companion works the same by typing — voice
          and text share one answering path and one evidence model.
        </p>
      ) : null}

      <p className="rounded border border-caution-500/30 bg-caution-100/50 px-3 py-2 text-[12px] leading-relaxed text-caution-700 dark:bg-caution-700/15 dark:text-caution-100">
        Do not enter confidential client or company information unless this workspace has been
        explicitly approved for it.
      </p>

      {error ? (
        <p role="alert" className="rounded bg-alert-100 px-3 py-2 text-[13px] text-alert-700">
          {error}
        </p>
      ) : null}

      <div className={`space-y-4 ${compact ? 'max-h-[50vh] overflow-y-auto' : ''}`}>
        {turns.map((turn, i) =>
          turn.role === 'user' ? (
            <p key={i} className="rounded bg-[var(--surface-inset)] px-3 py-2 text-[14px] font-medium">
              {turn.text}
            </p>
          ) : (
            <AnswerView
              key={i}
              response={turn.response!}
              speaking={speaking}
              onSpeak={() => speak(turn.response!.voice.spokenSummary)}
              onStop={stopSpeaking}
              onFollowUp={(q) => void ask(q, 'text')}
            />
          ),
        )}
      </div>
    </div>
  );
}

function AnswerView({
  response,
  speaking,
  onSpeak,
  onStop,
  onFollowUp,
}: {
  response: CompanionResponse;
  speaking: boolean;
  onSpeak: () => void;
  onStop: () => void;
  onFollowUp: (q: string) => void;
}) {
  return (
    <div className="surface space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="rounded bg-[var(--surface-inset)] px-1.5 py-0.5 font-medium">
            {response.mode.replace(/_/g, ' ')}
          </span>
          <span className="text-[var(--text-subtle)]">
            As of {new Date(response.asOf).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
          </span>
          <span className="text-[var(--text-subtle)]">
            · {response.generator === 'llm' ? 'model-assisted' : 'extractive'}
          </span>
          {response.insufficientEvidence ? (
            <span className="rounded bg-alert-100 px-1.5 py-0.5 font-medium text-alert-700">
              Insufficient evidence
            </span>
          ) : null}
        </div>
        {'speechSynthesis' in globalThis ? (
          <button
            type="button"
            onClick={speaking ? onStop : onSpeak}
            className="rounded border border-[var(--border)] px-2 py-1 text-[12px]"
          >
            {speaking ? `Stop (${response.voice.estimatedSeconds}s)` : `Read aloud (${response.voice.estimatedSeconds}s)`}
          </button>
        ) : null}
      </div>

      <p className="prose-reading text-[15px]">{response.directAnswer}</p>

      {response.verifiedFacts.length > 0 ? (
        <section className="label-evidence">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-verified-700 dark:text-verified-100">
            Verified facts
          </p>
          <ol className="space-y-2">
            {response.verifiedFacts.map((fact, i) => (
              <li key={i} className="text-[14px] leading-relaxed">
                {fact.text}
                {fact.citationIndexes.map((ci) => {
                  const citation = response.citations[ci];
                  if (!citation) return null;
                  return (
                    <a
                      key={ci}
                      href={`/evidence/${citation.claimId}`}
                      title={`${citation.sourceName} — ${citation.documentTitle}`}
                      className="ml-1 align-super text-[11px] font-semibold text-[var(--accent)] underline underline-offset-2"
                    >
                      [{ci + 1}]
                    </a>
                  );
                })}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {response.interpretations.length > 0 ? (
        <section className="label-interpretation">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-caution-700 dark:text-caution-100">
            Interpretation
          </p>
          <ul className="space-y-1.5 text-[14px] leading-relaxed text-[var(--text-muted)]">
            {response.interpretations.map((text, i) => (
              <li key={i}>{text}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {response.hypotheses.length > 0 ? (
        <section className="label-interpretation">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-caution-700 dark:text-caution-100">
            Hypotheses
          </p>
          <ul className="space-y-1.5 text-[14px] leading-relaxed text-[var(--text-muted)]">
            {response.hypotheses.map((text, i) => (
              <li key={i}>{text}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {response.counterEvidence.length > 0 ? (
        <section>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-alert-700 dark:text-alert-100">
            Counter-evidence
          </p>
          <ul className="space-y-1.5 text-[14px] leading-relaxed">
            {response.counterEvidence.map((item, i) => (
              <li key={i}>
                {item.text}
                {item.citationIndexes.map((ci) => {
                  const citation = response.citations[ci];
                  if (!citation) return null;
                  return (
                    <a
                      key={ci}
                      href={`/evidence/${citation.claimId}`}
                      className="ml-1 align-super text-[11px] font-semibold text-[var(--accent)]"
                    >
                      [{ci + 1}]
                    </a>
                  );
                })}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {response.conversationStarters.length > 0 ? (
        <section>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-subtle)]">
            Questions you could ask
          </p>
          <ol className="space-y-1.5 text-[14px] leading-relaxed">
            {response.conversationStarters.map((text, i) => (
              <li key={i}>{text}</li>
            ))}
          </ol>
        </section>
      ) : null}

      {response.unknowns.length > 0 ? (
        <section className="rounded bg-[var(--surface-sunken)] p-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-subtle)]">
            What this does not tell you
          </p>
          <ul className="space-y-1 text-[13px] leading-relaxed text-[var(--text-muted)]">
            {[...response.unknowns, ...response.coverageLimitations].map((text, i) => (
              <li key={i}>· {text}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {response.citations.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-[12px] font-medium text-[var(--text-subtle)]">
            {response.citations.length} citation{response.citations.length === 1 ? '' : 's'}
          </summary>
          <ol className="mt-2 space-y-1.5">
            {response.citations.map((citation, i) => (
              <li key={i} className="text-[12px] leading-relaxed">
                <span className="font-semibold">[{i + 1}]</span>{' '}
                <a
                  href={citation.sourceUrl ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="underline underline-offset-2"
                >
                  {citation.documentTitle}
                </a>{' '}
                <span className="text-[var(--text-subtle)]">
                  — {citation.sourceName} ·{' '}
                  {citation.publishedAt
                    ? new Date(citation.publishedAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })
                    : 'undated'}{' '}
                  · {citation.evidenceStrength.replace(/_/g, ' ').toLowerCase()}
                </span>{' '}
                <a href={`/evidence/${citation.claimId}`} className="text-[var(--accent)] underline underline-offset-2">
                  passage
                </a>
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      {response.suggestedFollowUps.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-t border-[var(--border)] pt-3">
          {response.suggestedFollowUps.map((q, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onFollowUp(q)}
              className="rounded border border-[var(--border)] px-2 py-1 text-[12px] hover:bg-[var(--surface-inset)]"
            >
              {q}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
