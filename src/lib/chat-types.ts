import type { AppVault, PortfolioPosition, PreparedDepositQuote, VerifyBalanceResult } from "./types";

export type ChatCard =
  | {
      kind: "vault";
      vault: AppVault;
    }
  | {
      kind: "position";
      position: PortfolioPosition;
    }
  | {
      kind: "allocation";
      amount: number;
      assetSymbol: string;
      vaults: AppVault[];
    }
  | {
      kind: "prepared-deposit";
      quote: PreparedDepositQuote;
      vault: AppVault;
    };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  cards?: ChatCard[];
  meta?: {
    verifyBalance?: VerifyBalanceResult;
  };
}
