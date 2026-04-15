"use client";

import { ChatPanel } from "@/components/chat/chat-panel";
import { Header } from "@/components/layout/header";
import { useInjectedWallet } from "@/components/providers";
import { ASSET_REGISTRY } from "@/config/constants";
import { useAgent } from "@/hooks/use-agent";
import { useWelcome } from "@/hooks/use-welcome";
import type { AppVault, PreparedDepositQuote } from "@/lib/types";

function isWalletSwitchIntent(input: string) {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return false;

  return [
    "change wallet",
    "switch wallet",
    "reconnect wallet",
    "i change my wallet",
    "i want to change my wallet",
    "我要换钱包",
    "切换钱包",
    "换钱包",
    "重新连接钱包",
  ].includes(normalized);
}

const chainNameMap: Record<number, string> = {
  1: "Ethereum",
  10: "Optimism",
  8453: "Base",
  42161: "Arbitrum",
};

export default function Home() {
  const wallet = useInjectedWallet();
  const agent = useAgent({
    walletAddress: wallet.address,
    chainId: wallet.chainId,
  });

  const walletNotice = !wallet.hasProvider
    ? "No injected wallet detected. Install MetaMask, Rabby, or another browser wallet to connect."
    : wallet.isConnected
      ? undefined
      : "Connect a browser wallet to unlock Base USDC deposits.";

  useWelcome({
    walletAddress: wallet.address,
    sendMessage: agent.sendMessage,
  });

  async function handleSendMessage(content: string) {
    if (isWalletSwitchIntent(content)) {
      if (!wallet.isConnected) {
        agent.appendAssistantMessage("No wallet is connected in the app yet. Use the top-right connect button first.");
        return;
      }

      agent.appendAssistantMessage("Opening your wallet account selector. Once the account changes, I will re-analyze the connected wallet automatically.");
      await wallet.reconnect();
      return;
    }

    await agent.sendMessage(content);
  }

  async function handlePrepareDeposit(vault: AppVault) {
    if (!wallet.address) return;

    let depositAmount = vault.recommendationAmount;
    if (!depositAmount) {
      const input = window.prompt(
        `How much USDC do you want to deposit into ${vault.vaultName}?`,
        "1",
      );
      if (!input) return;
      const parsed = Number(input);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        await agent.sendMessage(`That doesn't look like a valid USDC amount: "${input}"`);
        return;
      }
      depositAmount = parsed;
    }

    const amount = Math.floor(depositAmount * 10 ** ASSET_REGISTRY.USDC_BASE.decimals).toString();
    const response = await fetch("/api/earn/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromChainId: ASSET_REGISTRY.USDC_BASE.chainId,
        fromToken: ASSET_REGISTRY.USDC_BASE.symbol,
        vaultAddress: vault.vaultAddress,
        toChainId: vault.chainId,
        amount,
        fromAddress: wallet.address,
      }),
    });

    const payload = (await response.json()) as PreparedDepositQuote | { error: string };
    if (!response.ok || "error" in payload) {
      await agent.sendMessage(
        `I couldn't prepare that deposit yet: ${"error" in payload ? payload.error : "unknown error"}`,
      );
      return;
    }

    agent.appendPreparedDeposit(payload, vault);
  }

  async function handleDepositSuccess(result: {
    hash: `0x${string}`;
    quote: PreparedDepositQuote;
    vault: AppVault;
  }) {
    const amount = Number(result.quote.fromAmount) / 10 ** ASSET_REGISTRY.USDC_BASE.decimals;
    const baseScanUrl = `https://basescan.org/tx/${result.hash}`;
    agent.appendAssistantMessage(
      `Deposit confirmed on Base: ${amount.toFixed(2)} USDC → ${result.vault.protocolName} (${result.vault.vaultName}).\n\nView on BaseScan: ${baseScanUrl}\n\nNote: The position may take 5-15 minutes to appear in your portfolio due to LI.FI indexing delay. The deposit itself is already confirmed onchain.`,
    );
  }

  return (
    <main className="min-h-screen bg-[color:var(--page)] text-[color:var(--ink)]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.88),transparent_34%),linear-gradient(180deg,transparent,rgba(255,255,255,0.32))]" />
      <Header
        walletConnected={wallet.isConnected}
        hasInjectedWallet={wallet.hasProvider}
        walletLabel={wallet.shortAddress}
        chainLabel={wallet.chainId ? (chainNameMap[wallet.chainId] ?? `Chain ${wallet.chainId}`) : undefined}
        canSwitchToBase={wallet.isConnected && wallet.chainId !== ASSET_REGISTRY.USDC_BASE.chainId}
        walletNotice={walletNotice}
        onConnect={wallet.connect}
        onReconnect={wallet.reconnect}
        onDisconnect={wallet.clearConnection}
        onSwitchToBase={wallet.switchToBase}
      />
      <ChatPanel
        messages={agent.messages}
        isStreaming={agent.isStreaming}
        walletConnected={wallet.isConnected}
        onSend={handleSendMessage}
        onPrepareDeposit={handlePrepareDeposit}
        onDepositSuccess={handleDepositSuccess}
      />
    </main>
  );
}
