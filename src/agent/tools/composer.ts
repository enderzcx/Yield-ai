import { prepareDepositQuote } from "@/lib/composer-api";
import { getVaultDetails } from "@/lib/earn-api";

export async function prepareDeposit(args: {
  fromChainId: number;
  fromToken: string;
  vaultAddress: string;
  toChainId: number;
  amount: string;
  fromAddress: string;
  slippage?: number;
}) {
  const vault = await getVaultDetails(args.toChainId, args.vaultAddress);
  if (!vault.isTransactional) {
    throw new Error("This vault is not transactional");
  }

  const quote = await prepareDepositQuote(args);
  return {
    quote,
    vault,
  };
}
