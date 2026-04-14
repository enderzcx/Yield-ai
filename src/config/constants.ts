import type { AppVault, ChainId } from "@/lib/types";

export const APP_NAME = "Yield.AI";

function normalizeOpenAiBaseUrl(value?: string) {
  const baseUrl = (value ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
}

export const OPENAI_BASE_URL = normalizeOpenAiBaseUrl(process.env.OPENAI_BASE_URL);
export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
export const OPENAI_FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL ?? "gpt-4o-mini";
export const EARN_API_BASE_URL = "https://earn.li.fi/v1/earn";
export const COMPOSER_API_BASE_URL = "https://li.quest/v1";
export const SUPPORTED_READ_CHAINS: ChainId[] = [1, 10, 8453, 42161];
export const DEPOSIT_ENABLED_CHAIN_ID: ChainId = 8453;

export const ASSET_REGISTRY = {
  USDC_BASE: {
    symbol: "USDC",
    chainId: 8453 as const,
    tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
    displayName: "USD Coin",
  },
  ETH: {
    symbol: "ETH",
    chainId: 1 as const,
    tokenAddress: "0x0000000000000000000000000000000000000000",
    decimals: 18,
    displayName: "Ether",
  },
} as const;

export const MVP_SEARCH_SYMBOLS = ["USDC", "ETH", "USDT", "DAI"] as const;

export const RISK_PROTOCOL_BUCKETS = {
  blueChip: new Set(["aave-v3", "aave", "compound", "lido"]),
  established: new Set(["morpho-v1", "morpho", "euler", "etherfi"]),
};

export function isExecutableVaultForMvp(vault: Pick<AppVault, "chainId" | "assetSymbol">) {
  return vault.chainId === DEPOSIT_ENABLED_CHAIN_ID && vault.assetSymbol.toUpperCase() === "USDC";
}
