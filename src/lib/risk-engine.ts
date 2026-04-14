import { RISK_PROTOCOL_BUCKETS } from "@/config/constants";
import type { RiskLabel } from "./types";

export function scoreVaultRisk(input: { tvlUsd: number; apy: number; protocolName: string }) {
  let score = 5;

  if (input.tvlUsd > 50_000_000) score -= 2;
  else if (input.tvlUsd > 10_000_000) score -= 1;
  else if (input.tvlUsd < 1_000_000) score += 3;

  if (input.apy > 25) score += 2;
  else if (input.apy > 15) score += 1;

  const protocolKey = input.protocolName.toLowerCase();
  if (RISK_PROTOCOL_BUCKETS.blueChip.has(protocolKey)) score -= 2;
  else if (RISK_PROTOCOL_BUCKETS.established.has(protocolKey)) score -= 1;
  else score += 1;

  const clamped = Math.max(1, Math.min(10, score));
  return {
    riskScore: clamped,
    riskLabel: riskLabelFromScore(clamped),
  };
}

export function riskLabelFromScore(score: number): RiskLabel {
  if (score <= 3) return "Low";
  if (score <= 6) return "Medium";
  return "High";
}
