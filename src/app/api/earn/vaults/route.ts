import { NextRequest, NextResponse } from "next/server";
import { searchVaults } from "@/lib/earn-api";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const vaults = await searchVaults({
    chainId: searchParams.get("chainId") ? Number(searchParams.get("chainId")) : undefined,
    asset: searchParams.get("asset") ?? undefined,
    protocol: searchParams.get("protocol") ?? undefined,
    minTvlUsd: searchParams.get("minTvlUsd") ? Number(searchParams.get("minTvlUsd")) : undefined,
    sortBy: searchParams.get("sortBy") ?? undefined,
    limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
  });

  return NextResponse.json({ vaults });
}
