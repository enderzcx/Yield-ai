export type ChatRole = "user" | "assistant" | "tool" | "system";

export type RiskLabel = "Low" | "Medium" | "High";

export type ChainId = 1 | 10 | 8453 | 42161;

export interface UiHistoryMessage {
  role: Extract<ChatRole, "user" | "assistant">;
  content: string;
}

export interface AgentHistoryMessage {
  role: ChatRole;
  content?: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface AppVault {
  chainId: number;
  vaultAddress: string;
  protocolName: string;
  vaultName: string;
  assetSymbol: string;
  apy: number;
  tvlUsd: number;
  isTransactional: boolean;
  riskScore: number;
  riskLabel: RiskLabel;
  tags: string[];
  recommendationAmount?: number;
  recommendationAmountFormatted?: string;
  executionSupported: boolean;
}

export interface PortfolioPosition {
  id: string;
  protocolName: string;
  chainId: number;
  chainName: string;
  assetSymbol: string;
  positionName: string;
  apy?: number;
  valueUsd: number;
  earnedUsd?: number;
  amount?: number;
}

export interface VerifyBalanceResult {
  sufficient: boolean;
  walletBalance: number;
  requestedAmount: number;
  shortfall?: number;
  chainId: number;
  assetSymbol: string;
  tokenAddress?: string;
}

export interface PreparedDepositQuote {
  approvalNeeded: boolean;
  approvalAddress: string;
  transactionRequest: {
    to: string;
    data: string;
    value?: string;
    gasPrice?: string;
    gasLimit?: string;
    chainId: number;
    from?: string;
  };
  gasCost: {
    amount: string;
    amountUsd: string;
    symbol: string;
  } | null;
  estimatedOutput: {
    amount: string;
    amountMin: string;
    amountUsd: string;
  };
  fromAmount: string;
  fromToken: string;
  toChainId: number;
  vaultAddress: string;
}

export interface AgentRequestBody {
  walletAddress?: string;
  chainId?: number;
  message: string;
  history?: UiHistoryMessage[];
  knownPositions?: PortfolioPosition[];
}

export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "tool_start"; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: unknown; duration_ms: number }
  | { type: "confirm_needed"; name: string; args: Record<string, unknown>; description: string }
  | { type: "done"; content: string; rounds: number }
  | { type: "error"; error: string };
