# Yield.AI - AI Native DeFi Yield Agent (Plan v4)

## Context

LI.FI DeFi Mullet Hackathon #1 (Apr 8-14, $5000 USDC). Track: **AI x Earn**.
Judging: API Integration 35%, Innovation 25%, Completeness 20%, Presentation 20%.
Solo builder, 5 days to ship a working deployed app.

**Problem**: DeFi yield is fragmented - 672+ vaults across 21 chains, 20+ protocols. Users must manually compare APY, assess risk, bridge assets, and execute deposits protocol by protocol.

**Solution**: Yield.AI - an AI Native yield agent. One chat interface does everything: connect wallet -> AI reads your existing positions -> verifies the asset you want to deploy -> recommends an optimal yield strategy -> handles approval + deposit -> monitors positions, all through conversation.

**AI Native Philosophy**: AI IS the product. The user never needs to know what a "vault" or "protocol" is. They say "I want to earn interest safely" and Yield.AI handles everything.

## Not Building (Explicit Scope Cuts)
- Separate portfolio page (portfolio lives inside chat as cards)
- Withdraw flow - no withdraw tool, no `[Withdraw]` button. Out of scope for MVP. Positions display is read-only.
- Session keys / gasless tx (only if Day 5 has slack)
- Historical performance charts
- Multi-wallet support
- Mobile-specific layout
- Full wallet token scan across arbitrary ERC20s

## Architecture: Single-Page Chat + Fullstack Next.js

```text
User connects wallet
  |- AI auto-triggers: get_portfolio -> check existing positions
  |                    -> if empty, ask user what assets they want to deploy
  |                    -> if positions exist, show summary + suggest optimization
  |
  |- Single Chat Interface
       |- POST /api/agent (streaming NDJSON)
            |- LLM (GPT-4o-mini, tool_calls)
            |- Tools:
            |    |- get_portfolio -> earn.li.fi (existing positions + wallet context)
            |    |- verify_balance -> viem (check user actually holds requested asset)
            |    |- search_vaults -> earn.li.fi (vault discovery)
            |    |- get_vault_details -> earn.li.fi
            |    |- score_risk -> pure computation
            |    |- prepare_deposit -> li.quest (quote + approval check)
            |
            |- Stream events -> render inline action cards
                 |- VaultCard (with [Deposit] button)
                 |- PositionCard (read-only, no withdraw)
                 |- AllocationCard (recommended split, individual [Deposit] per vault)
```

## Key Decisions

1. **Next.js 14 App Router** - API routes as backend, one Vercel deploy
2. **GPT-4o-mini** - cheapest with tool_calls, fastest latency, TradeAgent wrapper compatible
3. **Copy & simplify 4 TradeAgent files** - `llm`, `registry`, `executor`, `loop` (strip tracing/memory)
4. **Direct HTTP to Earn API** (no LI.FI SDK) - simpler, fewer deps, full control
5. **RainbowKit + wagmi** - wallet connect + tx signing
6. **Single page, chat only** - AI Native = no dashboard, no manual navigation
7. **No withdraw** - deposit-only MVP, positions are read-only display
8. **Simplified welcome** - use `get_portfolio` on connect instead of multi-chain ERC20 scan
9. **Narrow balance preflight** - once the user names an asset and amount, verify it onchain before showing deposit CTAs

## AI Native UX Flows

### Flow 1: New User (no existing positions)

```text
[User connects wallet on Base]
AI: [calls get_portfolio -> empty]
    Welcome! I'm your AI yield advisor. You're connected on Base.
    Tell me what you'd like to do - for example:
    "I have 2000 USDC and want safe yield"
    "Find me the highest APY vaults on Arbitrum"

User: I have 2000 USDC, keep it safe

AI: [calls verify_balance(wallet, chain=Base, asset=USDC, amount=2000)]
    I checked your wallet on Base - you have 2,143.27 USDC available.

AI: [calls search_vaults + score_risk]
    Here's my recommendation - all low-risk, blue-chip protocols:
    - 1,200 USDC -> Morpho (Base) | 8.4% APY | Low Risk | [Deposit]
    -   800 USDC -> Aave (Base)   | 6.2% APY | Low Risk | [Deposit]

    Diversified across 2 protocols. Est. annual yield ~$150.
    Pick one to start, or tell me to deposit both one by one.

User: deposit the Morpho one
AI: [calls prepare_deposit for Morpho vault]
    First-time deposit: USDC needs token approval for Morpho.
    I'll handle this in 2 steps:
    1. Approve USDC spending -> [Approve] (wallet popup)
    2. Deposit to vault -> [Deposit] (wallet popup)

[User clicks Approve -> signs -> then Deposit -> signs]
AI: 1,200 USDC deposited to Morpho!
    Want to deposit the Aave one too? [Deposit]
```

If balance verification fails:

```text
AI: I only found 643 USDC on Base, so I can't safely recommend a 2,000 USDC allocation yet.
    Want me to:
    - find opportunities for 643 USDC instead, or
    - look on another supported chain?
```

### Flow 2: Returning User (has positions)

```text
[User connects wallet]
AI: [calls get_portfolio -> finds positions]
    Welcome back! Here are your current positions:
    - Morpho USDC | $1,212 (+$12.30) | 8.4% APY
    - Aave USDC   |   $802 (+$1.80)  | 6.2% APY

    Total: $2,014 | Earned: $14.10
    Want me to look for better opportunities?
```

### Flow 3: Natural Language Exploration

```text
User: what's the highest yield for ETH right now?
AI: [calls search_vaults({ asset: "ETH", sortBy: "apy" })]
    Top ETH vaults:
    - Pendle (Ethereum)  | 12.1% APY | Med Risk | [Deposit]
    - Lido (Ethereum)    |  3.1% APY | Low Risk | [Deposit]
    - EtherFi (Arbitrum) |  4.8% APY | Low Risk | [Deposit]

    Pendle is highest but medium risk due to time-locked positions.
    Lido is the safest bet at 3.1%. What's your preference?
```

## LI.FI API Integration (Critical for 35% score)

### Earn Data API (`earn.li.fi`) - no auth needed, 100 req/min

| Endpoint | Used For |
|----------|----------|
| `GET /v1/earn/vaults?chainId=&asset=&protocol=&minTvlUsd=&sortBy=&limit=&cursor=` | Vault discovery |
| `GET /v1/earn/vaults/:chainId/:address` | Single vault details |
| `GET /v1/earn/chains` | Chain list |
| `GET /v1/earn/protocols` | Protocol list |
| `GET /v1/earn/portfolio/:address/positions` | User positions (welcome flow + portfolio check) |

### Composer (`li.quest`) - API key optional but recommended for rate limits

| Endpoint | Used For |
|----------|----------|
| `GET /v1/quote?fromChain=&toChain=&fromToken=&toToken={VAULT_ADDRESS}&fromAddress=&fromAmount=` | Build deposit tx |
| `GET /v1/status?txHash=` | Track cross-chain deposit |

**Critical gotchas:**
- `toToken` = vault's `address` field (NOT underlying token)
- `fromAmount` needs decimal adjustment (USDC = 6, ETH = 18)
- `analytics.tvl.usd` is a string, must parse to number
- `apy.reward`, `apy7d` can be `null` - always fallback
- Must check `isTransactional: true` before deposit
- Composer `/v1/quote` is `GET`, not `POST`
- Execute tx immediately after quote (stale quotes fail)
- ERC20 deposits require an approval tx before the deposit tx
- Spender address = `quote.estimate.approvalAddress` (NOT the vault address)

## Agent Tools (6 tools)

### get_portfolio (no confirmation) - doubles as welcome scanner
- Params: `walletAddress`
- Calls `earn.li.fi/v1/earn/portfolio/{address}/positions`
- On wallet connect: auto-invoked to detect existing positions and personalize greeting
- Results rendered as read-only PositionCards inline in chat

### verify_balance (no confirmation) - narrow asset preflight
- Params: `walletAddress, chainId, assetSymbol, tokenAddress?, amount`
- For ERC20s: uses viem `readContract(balanceOf)` on the selected token contract
- For native ETH: uses viem `getBalance`
- Returns `{ sufficient, walletBalance, requestedAmount, shortfall? }`
- Called after the user names a concrete asset + amount, before recommendations or deposit actions

### search_vaults (no confirmation)
- Params: `chainId?, asset?, protocol?, minApy?, minTvlUsd?, sortBy?, limit?`
- Calls `earn.li.fi/v1/earn/vaults`, runs risk engine on results

### get_vault_details (no confirmation)
- Params: `chainId, vaultAddress`
- Calls `earn.li.fi/v1/earn/vaults/{chainId}/{address}`

### score_risk (no confirmation, pure computation)
- Params: `vaults[]`
- Risk scoring: TVL size, APY anomaly, protocol reputation -> score 1-10

### prepare_deposit (requires confirmation)
- Params: `fromChainId, fromToken, vaultAddress, toChainId, amount, fromAddress, slippage?`
- Step 1: Verify `isTransactional` on vault
- Step 2: Call `li.quest/v1/quote` with `toToken = vaultAddress`
- Step 3: Extract `estimate.approvalAddress` from the quote response
- Step 4: Return to frontend: `{ approvalNeeded, approvalTx, depositTx, gasCost, estimatedOutput }`
- Frontend handles: check allowance -> if needed, send approval tx -> wait confirm -> send deposit tx

## Deposit Flow (Approval-Aware)

This is the critical path. ERC20 tokens (USDC, USDT, etc.) require a 2-step process.

```text
Frontend (use-deposit.ts):
  0. Before quote, confirm verify_balance.sufficient === true
  1. Receive quote from prepare_deposit tool
  2. Extract approvalAddress from quote.estimate.approvalAddress
  3. Check current allowance: erc20.allowance(user, approvalAddress)
  4. IF allowance < fromAmount:
     a. Build approval tx: erc20.approve(approvalAddress, fromAmount)
     b. Show [Approve] button -> user signs -> wait for tx confirm
     c. Show "Approved" status
  5. Show [Deposit] button -> user signs quote.transactionRequest -> wait for tx confirm
  6. Show "Deposited" status
  7. Agent auto-calls get_portfolio to confirm position

Native ETH deposits skip step 3-4 (no approval needed).
```

**Implementation in `use-deposit.ts`:**
- Uses wagmi `useWriteContract` for approval (ERC20 ABI)
- Uses wagmi `useSendTransaction` for deposit (raw tx from Composer)
- Uses wagmi `useWaitForTransactionReceipt` for both
- State machine: `idle -> verifying -> approving -> approved -> depositing -> done | error`

## Risk Engine (`lib/risk-engine.ts`)

Additive scoring from baseline 5:
- TVL > $50M: -2 / $10-50M: -1 / < $1M: +3
- APY > 25%: +2 / > 15%: +1
- Blue-chip (`aave`, `compound`, `lido`): -2 / Established (`morpho`, `euler`): -1 / Unknown: +1
- Clamped `[1, 10]`. Labels: 1-3 low, 4-6 medium, 7-10 high risk

## File Structure

```text
yield-ai/
  src/
    app/
      layout.tsx                -- Root + Providers
      page.tsx                  -- Single page: chat interface
      api/
        agent/route.ts          -- POST: streaming agent endpoint
        earn/vaults/route.ts    -- Proxy to earn.li.fi
        earn/portfolio/route.ts -- Proxy to earn.li.fi
        earn/quote/route.ts     -- Proxy to Composer (hides API key)
    agent/
      llm.ts                    -- From TradeAgent (~120 lines)
      loop.ts                   -- From TradeAgent (~60 lines)
      registry.ts               -- From TradeAgent
      executor.ts               -- From TradeAgent (~40 lines)
      prompt.ts                 -- System prompt (AI Native yield advisor persona)
      history.ts                -- In-memory (keep _sanitizeMessages!)
      tools/
        wallet.ts               -- verify_balance (narrow balance preflight)
        earn.ts                 -- search_vaults, get_vault_details
        portfolio.ts            -- get_portfolio (also welcome scanner)
        composer.ts             -- prepare_deposit (with approval info)
        risk.ts                 -- score_risk
    lib/
      earn-api.ts               -- Typed fetch client for earn.li.fi
      composer-api.ts           -- Typed fetch client for li.quest
      risk-engine.ts            -- Risk scoring logic
      format.ts                 -- Number/APY formatting
    components/
      providers.tsx             -- Wagmi + RainbowKit + ReactQuery
      chat/
        chat-panel.tsx          -- Full-page chat container
        message.tsx             -- Message bubble (text + inline cards)
        input.tsx               -- Chat input with suggested prompts
        vault-card.tsx          -- Actionable: APY, risk, [Deposit] button
        position-card.tsx       -- Read-only: balance, PnL (NO withdraw)
        allocation-card.tsx     -- Multi-vault strategy (display only, individual [Deposit] per vault)
        deposit-flow.tsx        -- Verify -> Approve -> Deposit state machine UI
        tx-status.tsx           -- Deposit progress indicator
      layout/
        header.tsx              -- Logo + wallet connect (minimal)
    hooks/
      use-agent.ts              -- Chat state + NDJSON stream consumer
      use-deposit.ts            -- Verify + approval + deposit state machine (wagmi)
      use-welcome.ts            -- Auto-trigger get_portfolio on wallet connect
    config/
      wagmi.ts                  -- Arbitrum, Base, Optimism, Ethereum
      constants.ts              -- API URLs, risk thresholds
```

## TradeAgent Code Reuse

| Source File | Target | Changes |
|-------------|--------|---------|
| `E:\CC\TradeAgent\agent\llm.mjs` | `agent/llm.ts` | Remove OTel + metrics, keep chatStream generator + fallback |
| `E:\CC\TradeAgent\agent\loop.mjs` | `agent/loop.ts` | Remove memory/cognition, keep core loop, add walletAddress context |
| `E:\CC\TradeAgent\agent\tools\registry.mjs` | `agent/registry.ts` | Add TS types, remove describeAction |
| `E:\CC\TradeAgent\agent\tools\executor.mjs` | `agent/executor.ts` | Remove OTel, keep error boundary + output budget |
| `E:\CC\TradeAgent\agent\history.mjs` | `agent/history.ts` | Remove SQLite/compression, KEEP _sanitizeMessages |

## Day-by-Day Plan

### Day 1 (Apr 9) - Foundation + Chat UI
- `create-next-app` + install `wagmi` / `rainbowkit` / `tanstack-query` / `viem`
- Single page layout: header (wallet) + full-page chat
- Providers, wagmi config (Arbitrum, Base, Optimism, Ethereum)
- Chat UI: message list + input + suggested prompts
- `earn-api.ts` + `/api/earn/vaults` proxy - verify Earn API responds
- `use-welcome.ts` hook (detect wallet connect -> auto-send get_portfolio)
- **Checkpoint: app loads, wallet connects, chat UI works, Earn API responds**

### Day 2 (Apr 10) - Agent Core + AI Native Welcome
- Port `llm.ts`, `registry.ts`, `executor.ts`, `loop.ts` from TradeAgent
- Build `prompt.ts` (AI Native yield advisor persona)
- Build tools: `verify_balance`, `search_vaults`, `get_vault_details`, `score_risk`, `get_portfolio`
- Build `/api/agent/route.ts` streaming endpoint
- Build `use-agent.ts` hook (NDJSON stream consumer)
- Wire wallet connect -> auto-send "analyze my wallet" -> AI responds
- Add the balance preflight branch: user states asset + amount -> `verify_balance` -> then recommendations
- Build `vault-card.tsx` (actionable, with `[Deposit]` button)
- Build `position-card.tsx` (read-only)
- **Checkpoint: connect wallet -> AI shows positions or prompts user -> balance check works -> vault search works**

### Day 3 (Apr 11) - Deposit Flow (Approval-Aware)
- Build `composer-api.ts` + `prepare_deposit` tool (returns approval info)
- Build `deposit-flow.tsx`: verify -> approval -> deposit state machine UI
- Build `use-deposit.ts`: `useWriteContract` (approve) + `useSendTransaction` (deposit) + `useWaitForTransactionReceipt`
- Wire: agent yields `prepare_deposit` -> card shows `[Approve]` -> `[Deposit]` -> `tx-status`
- Build `allocation-card.tsx` (recommended split display, each vault has individual `[Deposit]`)
- Test with real USDC on Base (request test funds in TG if needed)
- **Checkpoint: full flow -> verify balance -> recommend -> approve -> deposit -> confirm position via get_portfolio**

### Day 4 (Apr 12) - Polish + Deploy + Submission Prep
- Visual polish: loading states, error handling, smooth streaming
- Suggested prompts: "Find safe USDC vaults", "What's the highest APY?", "Check my positions"
- "Why this vault" explanations in AI responses (system prompt tuning)
- Deploy to Vercel + env vars (`OPENAI_API_KEY`, `LIFI_API_KEY`)
- Test full E2E on deployed version
- **Start submission prep**: draft tweet thread, outline write-up
- **Checkpoint: deployed + tweet draft ready**

### Day 5 (Apr 13-14) - Demo + Submit
- Record demo video (30-60s): connect wallet -> AI recommends -> approve -> deposit -> check positions
- Finalize tweet thread (see Submission Checklist below)
- Write brief write-up (see Submission Checklist below)
- Fill Google Form with all links
- Schedule tweet for Apr 14 09:00 UTC+8
- Final bug fixes from demo recording
- **Checkpoint: all 4 submission requirements met**

## Submission Checklist (Must Pass ALL)

### 1. Working Project
- [ ] Deployed at `yield-ai.vercel.app` OR screen-recorded demo showing real execution
- [ ] Must be functional - mockups do not count

### 2. Public Tweet/Thread (Apr 14, 09:00-12:00 UTC+8)

Required content in tweet/thread:
- [ ] "I just built Yield.AI with LI.FI Earn..."
- [ ] Project name: Yield.AI
- [ ] What it does: AI Native yield agent for DeFi
- [ ] Demo video embedded
- [ ] Live app link OR GitHub repo link
- [ ] Track: AI x Earn
- [ ] Tag `@lifiprotocol`
- [ ] Tag `@brucexu_eth` (Chinese submission)
- [ ] Posted within APAC window: Apr 14, 09:00-12:00 UTC+8
- [ ] Schedule tweet in advance using X's scheduled post feature

### 3. Brief Write-Up (in Google Form)

Must cover:
- [ ] What the project does
- [ ] How it uses BOTH Earn Data API AND Composer
- [ ] What you'd build next (roadmap)
- [ ] API feedback / developer experience notes

### 4. Google Form Submission

- [ ] All required fields filled
- [ ] Tweet URL included
- [ ] GitHub repo URL included
- [ ] Demo URL or video URL included

## Emergency Cuts

| Trigger | Cut |
|---------|-----|
| Behind end of Day 2 | Drop `vault-card` / `position-card` components, use plain text responses |
| Behind end of Day 3 | Drop deposit execution entirely, ship chat-only vault discovery + risk analysis. Demo video shows the conversation flow. Write-up explains deposit was planned. |
| Deposit approval flow too complex | Skip `allocation-card` entirely, only support single-vault deposit from `vault-card` |
| Composer quotes failing | Cache one successful quote for demo video, add "quotes may be temporarily unavailable" fallback |
| Vercel deploy issues | Use demo video as primary submission, link GitHub repo |

## Verification

1. **AI Native**: Connect wallet -> AI speaks first (`get_portfolio`) -> personalized greeting without user typing
2. **Balance Check**: User says "I have 2000 USDC" -> app verifies onchain balance before recommending allocations
3. **API Integration**: "show me USDC vaults on Base" -> vault cards with APY, TVL, risk score (Earn Data API)
4. **Deposit Flow**: Click `[Deposit]` -> `[Approve]` popup -> `[Deposit]` popup -> `tx-status` -> position confirmed (Composer API)
5. **Portfolio**: "how's my money" -> position cards with PnL inline in chat (Portfolio API)
6. **E2E**: Connect -> auto-greet -> verify balance -> explore -> deposit (with approval) -> verify position
7. **Submission**: Tweet has all required tags + content, write-up covers both APIs, form is complete
