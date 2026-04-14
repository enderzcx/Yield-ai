import { erc20Abi } from "viem";
import { ASSET_REGISTRY, DEPOSIT_ENABLED_CHAIN_ID } from "@/config/constants";
import { getPublicClient } from "@/lib/chain-clients";
import type { VerifyBalanceResult } from "@/lib/types";

function normalizeTokenAddress(value?: string) {
  if (!value) return ASSET_REGISTRY.USDC_BASE.tokenAddress;

  const trimmed = value.trim();
  const matched = trimmed.match(/0x[a-fA-F0-9]{40}/);
  if (!matched) return ASSET_REGISTRY.USDC_BASE.tokenAddress;

  const normalized = matched[0];
  if (normalized.toLowerCase() === "0x0000000000000000000000000000000000000000") {
    return ASSET_REGISTRY.USDC_BASE.tokenAddress;
  }

  return normalized;
}

export async function verifyBalance(args: {
  walletAddress: string;
  chainId: number;
  assetSymbol: string;
  tokenAddress?: string;
  amount: number | string;
}) {
  const amount = Number(args.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("verify_balance requires a positive amount");
  }

  if (args.chainId !== DEPOSIT_ENABLED_CHAIN_ID || args.assetSymbol.toUpperCase() !== "USDC") {
    throw new Error("v1 balance verification is limited to Base USDC");
  }

  const client = getPublicClient(args.chainId);
  const tokenAddress = normalizeTokenAddress(args.tokenAddress) as `0x${string}`;
  const rawBalance = await client.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [args.walletAddress as `0x${string}`],
  });

  const walletBalance = Number(rawBalance) / 10 ** ASSET_REGISTRY.USDC_BASE.decimals;
  const result: VerifyBalanceResult = {
    sufficient: walletBalance >= amount,
    walletBalance,
    requestedAmount: amount,
    shortfall: walletBalance >= amount ? undefined : amount - walletBalance,
    chainId: args.chainId,
    assetSymbol: args.assetSymbol.toUpperCase(),
    tokenAddress,
  };

  return result;
}
