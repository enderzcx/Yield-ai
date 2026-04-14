"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type {
  AppVault,
  PreparedDepositQuote,
  StreamEvent,
  UiHistoryMessage,
  VerifyBalanceResult,
} from "@/lib/types";
import type { ChatCard, ChatMessage } from "@/lib/chat-types";

const INITIAL_MESSAGE: ChatMessage = {
  id: crypto.randomUUID(),
  role: "assistant",
  content:
    "Connect a wallet and tell me what you want to deploy. For v1, I can execute real Base USDC deposits and show view-only ideas across other chains.",
};

function nextMessageId() {
  return crypto.randomUUID();
}

async function getAgentRouteError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload.error) {
      return payload.error;
    }
  } catch {
    // Ignore JSON parsing failures and fall through to a generic message.
  }

  return "The agent route failed before streaming started.";
}

export function useAgent({
  walletAddress,
  chainId,
}: {
  walletAddress?: string;
  chainId?: number;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastVerifiedBalance, setLastVerifiedBalance] = useState<VerifyBalanceResult | null>(null);
  const verifiedBalanceRef = useRef<VerifyBalanceResult | null>(null);

  const history = useMemo<UiHistoryMessage[]>(
    () =>
      messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    [messages],
  );

  const appendPreparedDeposit = useCallback((quote: PreparedDepositQuote, vault: AppVault) => {
    setMessages((current) => [
      ...current,
      {
        id: nextMessageId(),
        role: "assistant",
        content: `Prepared ${vault.protocolName} on Base. Approval and deposit stay separate so the flow is honest about signatures.`,
        cards: [{ kind: "prepared-deposit", quote, vault }],
      },
    ]);
  }, []);

  const appendAssistantMessage = useCallback((content: string) => {
    setMessages((current) => [
      ...current,
      {
        id: nextMessageId(),
        role: "assistant",
        content,
      },
    ]);
  }, []);

  const appendPortfolioSnapshot = useCallback((positions: ChatCard[]) => {
    setMessages((current) => [
      ...current,
      {
        id: nextMessageId(),
        role: "assistant",
        content: "Your latest positions are synced below.",
        cards: positions,
      },
    ]);
  }, []);

  const refreshPortfolio = useCallback(async () => {
    if (!walletAddress) return;
    const response = await fetch(
      `/api/earn/portfolio?walletAddress=${encodeURIComponent(walletAddress)}`,
      { cache: "no-store" },
    );
    const data = (await response.json()) as { positions?: unknown[] };
    const cards =
      data.positions?.map((position) => ({
        kind: "position" as const,
        position: position as never,
      })) ?? [];

    if (cards.length > 0) {
      appendPortfolioSnapshot(cards);
    }
  }, [appendPortfolioSnapshot, walletAddress]);

  const sendMessage = useCallback(
    async (content: string) => {
      const userMessage: ChatMessage = {
        id: nextMessageId(),
        role: "user",
        content,
      };

      const assistantId = nextMessageId();
      setMessages((current) => [
        ...current,
        userMessage,
        {
          id: assistantId,
          role: "assistant",
          content: "",
        },
      ]);
      setIsStreaming(true);

      try {
        const response = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress,
            chainId,
            message: content,
            history,
          }),
        });

        if (!response.ok || !response.body) {
          const errorMessage = await getAgentRouteError(response);
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId ? { ...message, content: errorMessage } : message,
            ),
          );
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as StreamEvent;

            if (event.type === "text") {
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantId
                    ? { ...message, content: `${message.content}${event.text}` }
                    : message,
                ),
              );
              continue;
            }

            if (event.type === "tool_result") {
              setMessages((current) =>
                current.map((message) => {
                  if (message.id !== assistantId) return message;
                  return {
                    ...message,
                    cards: mergeCards(message.cards, event, verifiedBalanceRef.current, (value) => {
                      verifiedBalanceRef.current = value;
                      setLastVerifiedBalance(value);
                    }),
                    meta:
                      event.name === "verify_balance"
                        ? { ...message.meta, verifyBalance: event.result as VerifyBalanceResult }
                        : message.meta,
                  };
                }),
              );
              continue;
            }

            if (event.type === "error") {
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantId ? { ...message, content: event.error } : message,
                ),
              );
            }
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to reach the agent route.";
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantId ? { ...item, content: message } : item,
          ),
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [chainId, history, walletAddress],
  );

  return {
    messages,
    isStreaming,
    sendMessage,
    appendAssistantMessage,
    appendPreparedDeposit,
    refreshPortfolio,
    lastVerifiedBalance,
  };
}

function mergeCards(
  currentCards: ChatCard[] | undefined,
  event: Extract<StreamEvent, { type: "tool_result" }>,
  lastVerifiedBalance: VerifyBalanceResult | null,
  setLastVerifiedBalance: (value: VerifyBalanceResult | null) => void,
) {
  const cards = [...(currentCards ?? [])];

  if (event.name === "verify_balance") {
    const verifyBalance = event.result as VerifyBalanceResult;
    setLastVerifiedBalance(verifyBalance);
    return cards;
  }

  if (event.name === "get_portfolio") {
    const positions = ((event.result as { positions?: unknown[] }).positions ?? []).map((position) => ({
      kind: "position" as const,
      position: position as never,
    }));
    return [...cards, ...positions];
  }

  if (event.name === "search_vaults") {
    const sourceVaults = event.result as AppVault[];
    const vaults = sourceVaults.map((vault, index) => {
      if (lastVerifiedBalance?.sufficient && vault.executionSupported) {
        const amount =
          sourceVaults.length === 1
            ? lastVerifiedBalance.requestedAmount
            : index === 0
              ? lastVerifiedBalance.requestedAmount * 0.6
              : lastVerifiedBalance.requestedAmount * 0.4;
        return {
          ...vault,
          recommendationAmount: Math.max(amount, 0),
        };
      }
      return vault;
    });

    const nextCards: ChatCard[] = vaults.slice(0, 2).map((vault) => ({
      kind: "vault",
      vault,
    }));

    if (lastVerifiedBalance?.sufficient && nextCards.length > 1) {
      nextCards.unshift({
        kind: "allocation",
        amount: lastVerifiedBalance.requestedAmount,
        assetSymbol: lastVerifiedBalance.assetSymbol,
        vaults: vaults.slice(0, 2),
      });
    }

    return [...cards, ...nextCards];
  }

  if (event.name === "prepare_deposit") {
    const payload = event.result as {
      quote?: PreparedDepositQuote;
      vault?: AppVault;
    };

    if (payload.quote && payload.vault) {
      return [
        ...cards,
        {
          kind: "prepared-deposit" as const,
          quote: payload.quote,
          vault: payload.vault,
        },
      ];
    }
  }

  return cards;
}
