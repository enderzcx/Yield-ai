"use client";

import { formatCompactCurrency, formatCurrency, formatPercent } from "@/lib/format";
import type { AppVault } from "@/lib/types";

const chainLabelById: Record<number, string> = {
  1: "Ethereum",
  10: "Optimism",
  8453: "Base",
  42161: "Arbitrum",
};

export function VaultCard({
  vault,
  walletConnected,
  onPrepareDeposit,
}: {
  vault: AppVault;
  walletConnected: boolean;
  onPrepareDeposit: (vault: AppVault) => Promise<void> | void;
}) {
  const disabled = !walletConnected || !vault.executionSupported;
  const needsAmount = !vault.recommendationAmount;
  const helperText = !walletConnected
    ? "Connect wallet to prepare a deposit."
    : !vault.executionSupported
      ? "View-only in v1. Real execution is limited to Base USDC."
      : needsAmount
        ? "Click to enter an amount, or tell me one in chat."
        : "Approval and deposit will stay separate.";

  return (
    <article className="signal-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">
            {vault.protocolName} / {chainLabelById[vault.chainId] ?? `Chain ${vault.chainId}`}
          </p>
          <h3 className="mt-2 font-display text-xl text-[color:var(--ink)]">{vault.vaultName}</h3>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            {vault.assetSymbol} strategy with {formatCompactCurrency(vault.tvlUsd)} TVL.
          </p>
        </div>
        <span className={`risk-pill risk-pill--${vault.riskLabel.toLowerCase()}`}>{vault.riskLabel} risk</span>
      </div>

      <div className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <p className="metric-label">APY</p>
          <p className="metric-value">{formatPercent(vault.apy)}</p>
        </div>
        <div>
          <p className="metric-label">TVL</p>
          <p className="metric-value">{formatCompactCurrency(vault.tvlUsd)}</p>
        </div>
        <div>
          <p className="metric-label">Suggested</p>
          <p className="metric-value">
            {vault.recommendationAmount
              ? formatCurrency(vault.recommendationAmount)
              : "Pending"}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-[color:var(--border-soft)] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md text-xs leading-5 text-[color:var(--muted)]">{helperText}</p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => void onPrepareDeposit(vault)}
          className="action-button action-button--secondary"
        >
          {needsAmount ? "Set amount & prepare" : "Prepare deposit"}
        </button>
      </div>
    </article>
  );
}
