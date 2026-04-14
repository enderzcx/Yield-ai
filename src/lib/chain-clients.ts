import { createPublicClient, http } from "viem";
import { arbitrum, base, mainnet, optimism } from "viem/chains";

export const chainLookup = {
  1: mainnet,
  10: optimism,
  8453: base,
  42161: arbitrum,
} as const;

export function getPublicClient(chainId: number) {
  const chain = chainLookup[chainId as keyof typeof chainLookup];
  if (!chain) {
    throw new Error(`Unsupported chain for public client: ${chainId}`);
  }

  return createPublicClient({
    chain,
    transport: http(),
  });
}
