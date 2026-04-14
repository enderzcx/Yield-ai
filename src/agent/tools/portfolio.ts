import { getPortfolioPositions } from "@/lib/earn-api";

export async function getPortfolio(args: { walletAddress: string }) {
  return {
    positions: await getPortfolioPositions(args.walletAddress),
  };
}
