"use client";

import { formatCurrency, formatPercent, formatTokenAmount } from "@/lib/format";
import type { PortfolioPosition } from "@/lib/types";

export function PositionCard({ position }: { position: PortfolioPosition }) {
  return (
    <article className="signal-card signal-card--muted">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{position.protocolName}</p>
          <h3 className="mt-2 font-display text-xl text-[color:var(--ink)]">{position.positionName}</h3>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            {position.chainName} / {position.assetSymbol}
          </p>
        </div>
        {typeof position.apy === "number" ? (
          <span className="rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-xs text-[color:var(--muted)]">
            {formatPercent(position.apy)}
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <p className="metric-label">Value</p>
          <p className="metric-value">{formatCurrency(position.valueUsd)}</p>
        </div>
        <div>
          <p className="metric-label">Earned</p>
          <p className="metric-value">
            {typeof position.earnedUsd === "number" ? formatCurrency(position.earnedUsd) : "N/A"}
          </p>
        </div>
        <div>
          <p className="metric-label">Amount</p>
          <p className="metric-value">
            {typeof position.amount === "number"
              ? formatTokenAmount(position.amount, position.assetSymbol, 3)
              : "N/A"}
          </p>
        </div>
      </div>
    </article>
  );
}
