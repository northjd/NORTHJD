'use client';

import { useState } from 'react';
import { createMeetingBriefAction } from '@/app/(app)/prepare/actions';

export function MeetingForm({ companies }: { companies: { id: string; name: string; slug: string }[] }) {
  const [companyEntityId, setCompanyEntityId] = useState('');
  const [pending, setPending] = useState(false);

  const selected = companies.find((c) => c.id === companyEntityId);

  return (
    <form
      action={async (formData) => {
        setPending(true);
        await createMeetingBriefAction(formData);
      }}
      className="surface space-y-4 p-5"
    >
      <div>
        <label htmlFor="companyEntityId" className="mb-1 block text-[13px] font-medium">
          Company
        </label>
        <select
          id="companyEntityId"
          name="companyEntityId"
          value={companyEntityId}
          onChange={(e) => setCompanyEntityId(e.target.value)}
          className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px]"
        >
          <option value="">Not in the list — type a name below</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input type="hidden" name="companyName" value={selected?.name ?? ''} />
      </div>

      {!companyEntityId ? (
        <div>
          <label htmlFor="companyNameFree" className="mb-1 block text-[13px] font-medium">
            Company name
          </label>
          <input
            id="companyNameFree"
            name="companyName"
            required
            placeholder="e.g. a prospect not yet tracked"
            className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px]"
          />
          <p className="mt-1 text-[12px] text-[var(--text-subtle)]">
            A company with no tracked events will produce a brief that says so, rather than one that
            invents context.
          </p>
        </div>
      ) : null}

      <div>
        <label htmlFor="objective" className="mb-1 block text-[13px] font-medium">
          Meeting objective
        </label>
        <input
          id="objective"
          name="objective"
          placeholder="e.g. explore appetite for a planning transformation"
          className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px]"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="meetingAt" className="mb-1 block text-[13px] font-medium">
            Date and time
          </label>
          <input
            id="meetingAt"
            name="meetingAt"
            type="datetime-local"
            className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px]"
          />
        </div>
        <div>
          <label htmlFor="lookbackDays" className="mb-1 block text-[13px] font-medium">
            Look back
          </label>
          <select
            id="lookbackDays"
            name="lookbackDays"
            defaultValue="90"
            className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px]"
          >
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="365">12 months</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="attendees" className="mb-1 block text-[13px] font-medium">
          Attendees
        </label>
        <textarea
          id="attendees"
          name="attendees"
          rows={3}
          placeholder={'One per line: Name — Role\nOnly publicly known roles are used.'}
          className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px]"
        />
        <p className="mt-1 text-[12px] text-[var(--text-subtle)]">
          The brief uses only publicly documented roles and statements. No private or speculative
          information about individuals.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="topics" className="mb-1 block text-[13px] font-medium">
            Topics
          </label>
          <input
            id="topics"
            name="topics"
            placeholder="comma separated"
            className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px]"
          />
        </div>
        <div>
          <label htmlFor="depth" className="mb-1 block text-[13px] font-medium">
            Depth
          </label>
          <select
            id="depth"
            name="depth"
            defaultValue="executive"
            className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px]"
          >
            <option value="foundation">Foundation</option>
            <option value="executive">Executive</option>
            <option value="expert">Expert</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="personalNotes" className="mb-1 block text-[13px] font-medium">
          Your own notes
        </label>
        <textarea
          id="personalNotes"
          name="personalNotes"
          rows={3}
          className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px]"
        />
        <p className="mt-1 text-[12px] text-[var(--text-subtle)]">
          Kept separate from verified source material and never cited as evidence.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-[var(--accent)] px-3 py-2 text-[14px] font-medium text-white disabled:opacity-60"
      >
        {pending ? 'Building brief…' : 'Build brief'}
      </button>
    </form>
  );
}
