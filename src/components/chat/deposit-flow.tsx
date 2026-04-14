"use client";

import { useMemo } from "react";
import { useDeposit } from "@/hooks/use-deposit";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";
import type { AppVault, PreparedDepositQuote } from "@/lib/types";
import { TxStatus } from "./tx-status";

const chainLabelById: Record<number, string> = {
  1: "Ethereum",
  10: "Optimism",
  8453: "Base",
  42161: "Arbitrum",
};

export function DepositFlow({
  quote,
  vault,
  onSuccess,
}: {
  quote: PreparedDepositQuote;
  vault: AppVault;
  onSuccess?: (result: {
    hash: `0x${string}`;
    quote: PreparedDepositQuote;
    vault: AppVault;
  }) => Promise<void> | void;
}) {
  const flow = useDeposit({
    quote,
    onSuccess: onSuccess
      ? async (result) => {
          await onSuccess({ ...result, vault });
        }
      : undefined,
  });

  const primaryAction = useMemo(() => {
    if (flow.chainMismatch) {
      return {
        label: "Switch to Base",
        onClick: () => void flow.switchToBase(),
        disabled: flow.isWorking,
      };
    }

    if (quote.approvalNeeded && flow.step !== "approved" && flow.step !== "depositing" && flow.step !== "done") {
      return {
        label: flow.step === "approving" ? "Approving..." : "Approve USDC",
        onClick: () => void flow.approve(),
        disabled: flow.isWorking,
      };
    }

    if (flow.step === "done") {
      return {
        label: "Deposit confirmed",
        onClick: () => undefined,
        disabled: true,
      };
    }

    return {
      label: flow.step === "depositing" ? "Depositing..." : "Send deposit",
      onClick: () => void flow.deposit(),
      disabled: flow.isWorking,
    };
  }, [flow, quote.approvalNeeded]);

  return (
    <section className="signal-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-[color:var(--accent)]">Prepared deposit</p>
          <h3 className="mt-2 font-display text-2xl text-[color:var(--ink)]">{vault.protocolName}</h3>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            {vault.assetSymbol} / {chainLabelById[vault.chainId] ?? `Chain ${vault.chainId}`}
          </p>
        </div>

        <div className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-2)] px-3 py-1 text-xs text-[color:var(--muted)]">
          Base USDC execution
        </div>
      </div>

      <div className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <p className="metric-label">Suggested</p>
          <p className="metric-value">{formatCurrency(Number(quote.fromAmount) / 1_000_000)}</p>
        </div>
        <div>
          <p className="metric-label">Estimated out</p>
          <p className="metric-value">{formatCurrency(Number(quote.estimatedOutput.amountUsd || 0))}</p>
        </div>
        <div>
          <p className="metric-label">Gas</p>
          <p className="metric-value">
            {quote.gasCost ? formatCompactCurrency(Number(quote.gasCost.amountUsd || 0)) : "Unavailable"}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4 border-t border-[color:var(--border-soft)] pt-4">
        <TxStatus label={flow.statusLabel} hash={flow.depositHash ?? flow.approvalHash} />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-md text-xs leading-5 text-[color:var(--muted)]">
            One primary action at a time. Approval stays explicit, and the actual deposit is always a separate signature.
          </p>

          <button
            type="button"
            disabled={primaryAction.disabled}
            onClick={primaryAction.onClick}
            className={flow.chainMismatch ? "action-button action-button--secondary" : "action-button action-button--primary"}
          >
            {primaryAction.label}
          </button>
        </div>
      </div>
    </section>
  );
}
