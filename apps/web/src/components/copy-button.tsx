'use client';

import { useState } from 'react';

export function CopyButton({
  text,
  label,
  className = '',
  full = false,
}: {
  text: string;
  label: string;
  className?: string;
  full?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard denied (insecure context or permission). Fall back to selection.
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={`rounded border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--surface-inset)] ${full ? 'w-full' : ''} ${className}`}
    >
      {copied ? 'Copied — citations included' : label}
    </button>
  );
}
