"use client";

import { useEffect, useRef } from "react";
import { ChatInput } from "./input";
import type { ChatMessage as ChatMessageModel } from "@/lib/chat-types";
import type { AppVault, PreparedDepositQuote } from "@/lib/types";
import { ChatMessage } from "./message";

export function ChatPanel({
  messages,
  isStreaming,
  walletConnected,
  onSend,
  onPrepareDeposit,
  onDepositSuccess,
}: {
  messages: ChatMessageModel[];
  isStreaming: boolean;
  walletConnected: boolean;
  onSend: (content: string) => Promise<void>;
  onPrepareDeposit: (vault: AppVault) => Promise<void>;
  onDepositSuccess: (result: {
    hash: `0x${string}`;
    quote: PreparedDepositQuote;
    vault: AppVault;
  }) => Promise<void>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isStreaming]);

  return (
    <section className="flex min-h-[calc(100vh-72px)] items-start justify-center px-4 pb-8 pt-6 sm:px-6">
      <div className="w-full max-w-[42rem] space-y-4">
        {messages.length <= 1 && (
          <div className="space-y-2 text-center pt-2 pb-2">
            <h2 className="font-display text-[1.8rem] leading-[1.08] tracking-tight text-[color:var(--ink)] sm:text-[2.2rem]">
              What would you like to earn?
            </h2>
            <p className="mx-auto max-w-md text-sm leading-6 text-[color:var(--muted)]">
              Tell me in plain English. I'll find vaults, score risk, and handle deposits on Base.
            </p>
          </div>
        )}

        <div className="surface-pane overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border-soft)] px-4 py-3 sm:px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--accent)] text-[10px] font-bold text-white">
                AI
              </div>
              <span className="text-sm font-medium text-[color:var(--ink)]">Yield.AI</span>
            </div>

            <div className="flex items-center gap-2 text-xs text-[color:var(--muted)]">
              {isStreaming ? (
                <>
                  <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-[color:var(--accent)]" />
                  Thinking...
                </>
              ) : (
                <>
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  Ready
                </>
              )}
            </div>
          </div>

          <div ref={scrollRef} className="max-h-[calc(100vh-320px)] min-h-[24rem] space-y-4 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                walletConnected={walletConnected}
                onPrepareDeposit={onPrepareDeposit}
                onDepositSuccess={onDepositSuccess}
              />
            ))}
          </div>

          <ChatInput disabled={isStreaming} onSend={onSend} />
        </div>
      </div>
    </section>
  );
}
