"use client";

import type { ChatMessage as ChatMessageModel } from "@/lib/chat-types";
import type { AppVault, PreparedDepositQuote } from "@/lib/types";
import { AllocationCard } from "./allocation-card";
import { DepositFlow } from "./deposit-flow";
import { PositionCard } from "./position-card";
import { VaultCard } from "./vault-card";

export function ChatMessage({
  message,
  walletConnected,
  onPrepareDeposit,
  onDepositSuccess,
}: {
  message: ChatMessageModel;
  walletConnected: boolean;
  onPrepareDeposit: (vault: AppVault) => Promise<void> | void;
  onDepositSuccess: (result: {
    hash: `0x${string}`;
    quote: PreparedDepositQuote;
    vault: AppVault;
  }) => Promise<void> | void;
}) {
  const isAssistant = message.role === "assistant";

  return (
    <div className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
      <div className="w-full space-y-3">
        {message.content ? (
          <div
            className={`max-w-[92%] whitespace-pre-wrap rounded-[1.35rem] px-4 py-3.5 text-sm leading-7 ${
              isAssistant
                ? "border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] text-[color:var(--ink)] shadow-[0_10px_24px_rgba(17,19,24,0.03)]"
                : "ml-auto bg-[color:var(--signal)] text-[color:var(--signal-ink)]"
            }`}
          >
            {message.content}
          </div>
        ) : null}

        <div className="space-y-3">
          {message.cards?.map((card, index) => {
            const key = `${message.id}-${card.kind}-${index}`;
            if (card.kind === "vault") {
              return (
                <VaultCard
                  key={key}
                  vault={card.vault}
                  walletConnected={walletConnected}
                  onPrepareDeposit={onPrepareDeposit}
                />
              );
            }
            if (card.kind === "position") {
              return <PositionCard key={key} position={card.position} />;
            }
            if (card.kind === "allocation") {
              return (
                <AllocationCard
                  key={key}
                  amount={card.amount}
                  assetSymbol={card.assetSymbol}
                  vaults={card.vaults}
                />
              );
            }
            if (card.kind === "prepared-deposit") {
              return (
                <DepositFlow
                  key={key}
                  quote={card.quote}
                  vault={card.vault}
                  onSuccess={onDepositSuccess}
                />
              );
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
}
