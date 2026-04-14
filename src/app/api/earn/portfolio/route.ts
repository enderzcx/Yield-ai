import { NextRequest, NextResponse } from "next/server";
import { getPortfolioPositions } from "@/lib/earn-api";

export async function GET(request: NextRequest) {
  const walletAddress = request.nextUrl.searchParams.get("walletAddress");
  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  }

  const positions = await getPortfolioPositions(walletAddress);
  return NextResponse.json({ positions });
}
