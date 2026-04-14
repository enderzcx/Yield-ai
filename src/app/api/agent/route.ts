import { NextRequest } from "next/server";
import { createToolExecutor } from "@/agent/executor";
import { createAgentLLM } from "@/agent/llm";
import { agentLoop } from "@/agent/loop";
import { buildSystemPrompt } from "@/agent/prompt";
import { createToolRegistry } from "@/agent/registry";
import { prepareDeposit } from "@/agent/tools/composer";
import { getVaultDetails, searchVaults } from "@/agent/tools/earn";
import { getPortfolio } from "@/agent/tools/portfolio";
import { scoreRisk } from "@/agent/tools/risk";
import { verifyBalance } from "@/agent/tools/wallet";
import type { AgentHistoryMessage, AgentRequestBody } from "@/lib/types";

export const runtime = "nodejs";

function createAgentRuntime() {
  const registry = createToolRegistry();
  registry.registerAll([
    {
      name: "get_portfolio",
      description: "Read LI.FI Earn portfolio positions for the connected wallet.",
      parameters: {
        type: "object",
        properties: { walletAddress: { type: "string" } },
        required: ["walletAddress"],
      },
    },
    {
      name: "verify_balance",
      description: "Verify the connected wallet holds the requested Base USDC amount before recommendations.",
      parameters: {
        type: "object",
        properties: {
          walletAddress: { type: "string" },
          chainId: { type: "number" },
          assetSymbol: { type: "string" },
          tokenAddress: { type: "string" },
          amount: { type: "number" },
        },
        required: ["walletAddress", "chainId", "assetSymbol", "amount"],
      },
    },
    {
      name: "search_vaults",
      description: "Search LI.FI Earn vaults using chain, asset, protocol, and sorting filters.",
      parameters: {
        type: "object",
        properties: {
          chainId: { type: "number" },
          asset: { type: "string" },
          protocol: { type: "string" },
          minTvlUsd: { type: "number" },
          sortBy: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
    {
      name: "get_vault_details",
      description: "Get one normalized LI.FI vault detail by chain and vault address.",
      parameters: {
        type: "object",
        properties: {
          chainId: { type: "number" },
          vaultAddress: { type: "string" },
        },
        required: ["chainId", "vaultAddress"],
      },
    },
    {
      name: "score_risk",
      description: "Compute risk labels for a list of vaults based on APY, TVL, and protocol reputation.",
      parameters: {
        type: "object",
        properties: {
          vaults: {
            type: "array",
            items: {
              type: "object",
              properties: {
                tvlUsd: { type: "number" },
                apy: { type: "number" },
                protocolName: { type: "string" },
              },
              required: ["tvlUsd", "apy", "protocolName"],
            },
          },
        },
        required: ["vaults"],
      },
    },
    {
      name: "prepare_deposit",
      description: "Prepare a Base USDC deposit quote and approval info for a transactional vault.",
      parameters: {
        type: "object",
        properties: {
          fromChainId: { type: "number" },
          fromToken: { type: "string" },
          vaultAddress: { type: "string" },
          toChainId: { type: "number" },
          amount: { type: "string" },
          fromAddress: { type: "string" },
          slippage: { type: "number" },
        },
        required: ["fromChainId", "fromToken", "vaultAddress", "toChainId", "amount", "fromAddress"],
      },
    },
  ]);

  const executor = createToolExecutor({ registry });
  executor.registerExecutors({
    get_portfolio: (args) => getPortfolio(args as { walletAddress: string }),
    verify_balance: (args) =>
      verifyBalance(
        args as {
          walletAddress: string;
          chainId: number;
          assetSymbol: string;
          tokenAddress?: string;
          amount: number | string;
        },
      ),
    search_vaults: (args) =>
      searchVaults(
        args as {
          chainId?: number;
          asset?: string;
          protocol?: string;
          minTvlUsd?: number;
          sortBy?: string;
          limit?: number;
        },
      ),
    get_vault_details: (args) => getVaultDetails(args as { chainId: number; vaultAddress: string }),
    score_risk: (args) =>
      scoreRisk(args as { vaults: Array<{ tvlUsd: number; apy: number; protocolName: string }> }),
    prepare_deposit: (args) =>
      prepareDeposit(
        args as {
          fromChainId: number;
          fromToken: string;
          vaultAddress: string;
          toChainId: number;
          amount: string;
          fromAddress: string;
          slippage?: number;
        },
      ),
  });

  return { llm: createAgentLLM(), executor };
}

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ type: "error", error: "OPENAI_API_KEY is not configured." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const body = (await request.json()) as AgentRequestBody;
  const runtime = createAgentRuntime();
  const historyMessages: AgentHistoryMessage[] = (body.history ?? []).map((message) => ({
    role: message.role,
    content: message.content,
  }));

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        for await (const event of agentLoop({
          historyMessages,
          userMessage: body.message,
          llm: runtime.llm,
          executor: runtime.executor,
          systemPrompt: buildSystemPrompt({
            walletAddress: body.walletAddress,
            chainId: body.chainId,
          }),
        })) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            `${JSON.stringify({
              type: "error",
              error: error instanceof Error ? error.message : "Unknown agent error",
            })}\n`,
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
