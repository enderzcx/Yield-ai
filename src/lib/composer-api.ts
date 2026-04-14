import { erc20Abi } from "viem";
import { ASSET_REGISTRY, COMPOSER_API_BASE_URL, DEPOSIT_ENABLED_CHAIN_ID } from "@/config/constants";
import { getPublicClient } from "./chain-clients";
import { serverFetch } from "./server-fetch";
import type { PreparedDepositQuote } from "./types";

type QuoteResponse = {
  estimate?: {
    approvalAddress?: string;
    gasCosts?: Array<{
      amount?: string;
      amountUSD?: string;
      token?: { symbol?: string };
    }>;
    toAmount?: string;
    toAmountMin?: string;
    toAmountUSD?: string;
    fromAmount?: string;
  };
  transactionRequest?: {
    to: string;
    data: string;
    value?: string;
    gasPrice?: string;
    gasLimit?: string;
    chainId: number;
    from?: string;
  };
};

async function composerFetch(params: URLSearchParams) {
  const response = await serverFetch(`${COMPOSER_API_BASE_URL}/quote?${params.toString()}`, {
    headers: {
      "Content-Type": "application/json",
      ...(process.env.LIFI_API_KEY ? { "x-lifi-api-key": process.env.LIFI_API_KEY } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Composer quote failed: ${response.status} ${body}`);
  }

  return (await response.json()) as QuoteResponse;
}

export async function prepareDepositQuote(args: {
  fromChainId: number;
  fromToken: string;
  vaultAddress: string;
  toChainId: number;
  amount: string;
  fromAddress: string;
  slippage?: number;
}) {
  if (args.fromChainId !== DEPOSIT_ENABLED_CHAIN_ID || args.toChainId !== DEPOSIT_ENABLED_CHAIN_ID) {
    throw new Error("Only Base to Base deposits are enabled in v1");
  }

  if (args.fromToken.toUpperCase() !== ASSET_REGISTRY.USDC_BASE.symbol) {
    throw new Error("Only Base USDC deposits are enabled in v1");
  }

  const params = new URLSearchParams({
    fromChain: String(args.fromChainId),
    toChain: String(args.toChainId),
    fromToken: args.fromToken,
    toToken: args.vaultAddress,
    fromAddress: args.fromAddress,
    fromAmount: args.amount,
  });

  if (args.slippage) {
    params.set("slippage", String(args.slippage));
  }

  const quote = await composerFetch(params);
  const approvalAddress = quote.estimate?.approvalAddress;
  const transactionRequest = quote.transactionRequest;

  if (!approvalAddress || !transactionRequest) {
    throw new Error("Composer quote missing approval or transaction data");
  }

  const client = getPublicClient(args.fromChainId);
  const allowance = await client.readContract({
    address: ASSET_REGISTRY.USDC_BASE.tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "allowance",
    args: [args.fromAddress as `0x${string}`, approvalAddress as `0x${string}`],
  });

  const gas = quote.estimate?.gasCosts?.[0];

  const result: PreparedDepositQuote = {
    approvalNeeded: allowance < BigInt(args.amount),
    approvalAddress,
    transactionRequest,
    gasCost: gas
      ? {
          amount: gas.amount ?? "0",
          amountUsd: gas.amountUSD ?? "0",
          symbol: gas.token?.symbol ?? "ETH",
        }
      : null,
    estimatedOutput: {
      amount: quote.estimate?.toAmount ?? "0",
      amountMin: quote.estimate?.toAmountMin ?? "0",
      amountUsd: quote.estimate?.toAmountUSD ?? "0",
    },
    fromAmount: quote.estimate?.fromAmount ?? args.amount,
    fromToken: args.fromToken,
    toChainId: args.toChainId,
    vaultAddress: args.vaultAddress,
  };

  return result;
}
