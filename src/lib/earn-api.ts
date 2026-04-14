import { isExecutableVaultForMvp } from "@/config/constants";
import { EARN_API_BASE_URL } from "@/config/constants";
import { serverFetch } from "./server-fetch";
import { scoreVaultRisk } from "./risk-engine";
import type { AppVault, PortfolioPosition } from "./types";

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum", 10: "Optimism", 56: "BNB", 100: "Gnosis",
  137: "Polygon", 250: "Fantom", 324: "zkSync", 8453: "Base",
  42161: "Arbitrum", 42170: "Arbitrum Nova", 43114: "Avalanche",
  59144: "Linea", 534352: "Scroll", 81457: "Blast", 34443: "Mode",
};

type EarnVault = {
  address: string;
  chainId: number;
  name?: string;
  slug?: string;
  tags?: string[];
  protocol?: { name?: string };
  analytics?: {
    apy?: { total?: number | null; base?: number | null };
    tvl?: { usd?: string | number | null };
  };
  isTransactional?: boolean;
  underlyingTokens?: Array<{ symbol?: string }>;
};

type EarnVaultListResponse = {
  data: EarnVault[];
};

type EarnPortfolioResponse = {
  positions: unknown[];
};

async function earnFetch<T>(path: string) {
  const response = await serverFetch(`${EARN_API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    next: { revalidate: 30 },
  });

  if (!response.ok) {
    throw new Error(`Earn API failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function normalizeVault(raw: EarnVault): AppVault {
  const assetSymbol = raw.underlyingTokens?.[0]?.symbol?.toUpperCase() ?? "UNKNOWN";
  const protocolName = raw.protocol?.name ?? "unknown";
  const apy = toNumber(raw.analytics?.apy?.total ?? raw.analytics?.apy?.base);
  const tvlUsd = toNumber(raw.analytics?.tvl?.usd);
  const { riskScore, riskLabel } = scoreVaultRisk({ tvlUsd, apy, protocolName });

  const baseVault: AppVault = {
    chainId: raw.chainId,
    vaultAddress: raw.address,
    protocolName,
    vaultName: raw.name ?? raw.slug ?? raw.address,
    assetSymbol,
    apy,
    tvlUsd,
    isTransactional: Boolean(raw.isTransactional),
    riskScore,
    riskLabel,
    tags: raw.tags ?? [],
    executionSupported: false,
  };

  return {
    ...baseVault,
    executionSupported: isExecutableVaultForMvp(baseVault),
  };
}

export async function searchVaults(params: {
  chainId?: number;
  asset?: string;
  protocol?: string;
  minTvlUsd?: number;
  sortBy?: string;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params.chainId) query.set("chainId", String(params.chainId));
  if (params.asset) query.set("asset", params.asset);
  if (params.protocol) query.set("protocol", params.protocol);
  if (params.minTvlUsd) query.set("minTvlUsd", String(params.minTvlUsd));
  if (params.sortBy) query.set("sortBy", params.sortBy);
  query.set("limit", String(params.limit ?? 6));

  const response = await earnFetch<EarnVaultListResponse>(`/vaults?${query.toString()}`);
  return response.data.map(normalizeVault);
}

export async function getVaultDetails(chainId: number, vaultAddress: string) {
  const raw = await earnFetch<EarnVault>(`/vaults/${chainId}/${vaultAddress}`);
  return normalizeVault(raw);
}

export async function getPortfolioPositions(walletAddress: string): Promise<PortfolioPosition[]> {
  const response = await earnFetch<EarnPortfolioResponse>(
    `/portfolio/${walletAddress}/positions`,
  );

  return response.positions.map((position, index) => normalizePortfolioPosition(position, index));
}

function normalizePortfolioPosition(raw: unknown, index: number): PortfolioPosition {
  const item = (raw ?? {}) as Record<string, unknown>;
  const protocol = (item.protocol ?? {}) as Record<string, unknown>;
  const chain = (item.chain ?? {}) as Record<string, unknown>;
  const asset = (item.asset ?? item.token ?? {}) as Record<string, unknown>;
  const metrics = (item.metrics ?? item.analytics ?? {}) as Record<string, unknown>;

  return {
    id: String(item.id ?? item.positionId ?? `${index}`),
    protocolName: String(protocol.name ?? item.protocolName ?? "Unknown Protocol"),
    chainId: toNumber(chain.chainId ?? item.chainId),
    chainName: String(chain.name ?? item.network ?? CHAIN_NAMES[toNumber(chain.chainId ?? item.chainId)] ?? "Unknown Chain"),
    assetSymbol: String(asset.symbol ?? item.assetSymbol ?? "UNKNOWN"),
    positionName: String(item.name ?? item.positionName ?? asset.symbol ?? "Position"),
    apy: toNumber(metrics.apy ?? item.apy, undefined),
    valueUsd: toNumber(metrics.valueUsd ?? item.valueUsd ?? item.balanceUsd ?? item.usdValue),
    earnedUsd: toNumber(metrics.earnedUsd ?? item.earnedUsd ?? item.pnlUsd, undefined),
    amount: toNumber(item.amount ?? item.balance ?? asset.amount, undefined),
  };
}
