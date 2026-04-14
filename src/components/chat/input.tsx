"use client";

import { useState } from "react";

const SUGGESTED_PROMPTS = [
  "I have 2000 USDC and want safe yield",
  "Show me Base USDC vaults",
  "Analyze my wallet",
];

export function ChatInput({
  disabled,
  onSend,
}: {
  disabled?: boolean;
  onSend: (value: string) => Promise<void> | void;
}) {
  const [value, setValue] = useState("");

  async function submit(nextValue: string) {
    const trimmed = nextValue.trim();
    if (!trimmed || disabled) return;
    setValue("");
    await onSend(trimmed);
  }

  return (
    <div className="border-t border-[color:var(--border-soft)] bg-[color:var(--surface-2)]/60 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap gap-1.5 mb-3">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={disabled}
            className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-2.5 py-1.5 text-[11px] text-[color:var(--muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] disabled:opacity-40"
            onClick={() => void submit(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>

      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(value);
        }}
      >
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Tell me what you want to earn..."
          disabled={disabled}
          className="flex-1 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface-1)] px-4 py-2.5 text-sm text-[color:var(--ink)] outline-none placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)] disabled:opacity-50"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit(value);
            }
          }}
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="action-button action-button--primary h-10 w-10 !p-0 flex-shrink-0"
          aria-label="Send"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 8L14 8M14 8L8 2M14 8L8 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </form>
    </div>
  );
}
