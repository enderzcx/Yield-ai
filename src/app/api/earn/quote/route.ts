import { NextRequest, NextResponse } from "next/server";
import { prepareDepositQuote } from "@/lib/composer-api";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      fromChainId: number;
      fromToken: string;
      vaultAddress: string;
      toChainId: number;
      amount: string;
      fromAddress: string;
      slippage?: number;
    };

    const quote = await prepareDepositQuote(body);
    return NextResponse.json(quote);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Quote failed" },
      { status: 400 },
    );
  }
}
