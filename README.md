# Yield.AI

Yield.AI is a Next.js App Router MVP for AI-guided yield discovery and deposit execution on LI.FI Earn.

The live transaction path is intentionally narrow:

- Search and recommendations can reference Ethereum, Base, Arbitrum, and Optimism.
- Real execution is limited to Base USDC.
- Approvals and deposits stay as separate wallet signatures.
- Wallet connection uses injected browser wallets only, such as MetaMask or Rabby.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- `viem` for wallet and chain interactions

## Environment

Copy `.env.example` to `.env.local` and fill in the values you need:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_FALLBACK_MODEL=gpt-4.1-mini
LIFI_API_KEY=
```

If you are using an OpenAI-compatible endpoint, set `OPENAI_BASE_URL` accordingly. Example:

```bash
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://enderzcxai.duckdns.org/v1
OPENAI_MODEL=gpt-4o-mini
```

There is no `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` anymore because this app no longer uses WalletConnect, RainbowKit, or wagmi.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification

```bash
npm run typecheck
npm run lint
npm run build
```

`npm run typecheck` runs `next typegen` before `tsc --noEmit`, which avoids the missing `.next/types` issue on a fresh checkout.

## Current MVP Flow

1. Connect an injected wallet.
2. Auto-read LI.FI portfolio positions.
3. Ask for a concrete Base USDC allocation.
4. Verify onchain balance before enabling deposit preparation.
5. Review LI.FI Earn vault recommendations.
6. Approve ERC20 spending if needed.
7. Send the deposit transaction.
8. Refresh portfolio positions after confirmation.
