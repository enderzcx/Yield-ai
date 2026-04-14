"use client";

import { formatCurrency, formatPercent } from "@/lib/format";
import type { AppVault } from "@/lib/types";

export function AllocationCard({
  amount,
  assetSymbol,
  vaults,
}: {
  amount: number;
  assetSymbol: string;
  vaults: AppVault[];
}) {
  return (
    <section className="ghost-pane p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-[color:var(--accent)]">Recommended split</p>
          <h3 className="mt-2 font-display text-2xl text-[color:var(--ink)]">
            {formatCurrency(amount)} {assetSymbol}
          </h3>
        </div>
        <p className="max-w-sm text-xs leading-5 text-[color:var(--muted)]">
          Allocation stays advisory. Each vault still gets prepared, approved, and sent separately.
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {vaults.map((vault) => (
          <div
            key={vault.vaultAddress}
            className="rounded-[1.2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-4 py-4"
          >
            <p className="eyebrow">{vault.protocolName}</p>
            <p className="mt-2 text-lg font-semibold text-[color:var(--ink)]">
              {vault.recommendationAmount ? formatCurrency(vault.recommendationAmount) : "Pending"}
            </p>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {formatPercent(vault.apy)} APY / {vault.riskLabel} risk
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
