import { getVaultDetails as earnGetVaultDetails, searchVaults as earnSearchVaults } from "@/lib/earn-api";

export async function searchVaults(args: {
  chainId?: number;
  asset?: string;
  protocol?: string;
  minTvlUsd?: number;
  sortBy?: string;
  limit?: number;
}) {
  return earnSearchVaults(args);
}

export async function getVaultDetails(args: { chainId: number; vaultAddress: string }) {
  return earnGetVaultDetails(args.chainId, args.vaultAddress);
}
