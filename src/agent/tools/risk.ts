import { scoreVaultRisk } from "@/lib/risk-engine";

export async function scoreRisk(args: {
  vaults: Array<{ tvlUsd: number; apy: number; protocolName: string }>;
}) {
  return args.vaults.map(scoreVaultRisk);
}
