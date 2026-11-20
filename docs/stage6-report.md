# AURUM AGENTS — Stage 6 Completion Report

**Date:** 2026-11-18
**Scope:** Connect real blockchain reads + transaction events — live stats,
"Recent activity" event feed (live subscription + bounded history), live
refresh on new events.
**Status:** COMPLETE. Contract not deployed; every section keeps its honest
not-deployed state and goes live the moment Stage 9 deploys. No BscScan API
key was needed (B8) — BscScan links are plain URLs.

## What was built

| # | Deliverable | Location |
|---|---|---|
| 1 | Stats panel wired to live contract reads | `frontend/src/components/StatsPanel.tsx` |
| 2 | Activity-feed hook — live watch + bounded history | `frontend/src/hooks/useActivityFeed.ts` |
| 3 | "Recent activity" feed component | `frontend/src/components/ActivityFeed.tsx` |
| 4 | Nav link "Activity" + section after Stats | `frontend/src/App.tsx` |
| 5 | Anvil integration test extended (58 → 93 PASS lines) | `frontend/scripts/anvil-integration-test.mjs` |

## 1. Live stats

`StatsPanel` now reads `useCollectionReads()` (the Stage 4 hook — no new
read plumbing). The five supply cards (Total minted, Free minted, Free
remaining, Paid minted, Paid remaining) show on-chain values formatted
with thousands separators when deployed. "Collection size (design)" still
shows the design constant 5,555, labelled design. "Floor price" stays
"DATA UNAVAILABLE" (no secondary market yet). "Contract address" shows the
truncated address linked to BscScan when deployed. The header badge flips
from amber "◆ Contract not deployed" to emerald "◆ Live on BSC Mainnet".
While reads are in flight: "Loading…"; on read error: "DATA UNAVAILABLE".
No value comes from the local gallery index or a hardcoded number.

## 2. "Recent activity" feed

Events watched (verified against `contracts/src/AurumAgents.sol`):
`FreeMinted`, `PaidMinted`, `Transfer`, `Withdrawn`, `BaseURISet`,
`BaseURIFrozen`, `Paused`, `Unpaused`, `OwnershipTransferred`.
Approval / ApprovalForAll are deliberately excluded as noise.

- **Live:** one `useWatchContractEvent` subscription per event, gated on
  `CONTRACT_DEPLOYED`. On every event the react-query cache is invalidated
  (same pattern as `useAurumWrites.ts`), so stats / eligibility /
  ownership refresh without a reload, and the event is prepended to the
  feed.
- **History:** on mount when deployed, the last 10,000 blocks of past logs
  via the wagmi public client (the config's fallback transport: PublicNode
  first, dataseed second), decoded with viem `parseEventLogs`. Block
  timestamps fetched via `getBlock`, cached per block; a timestamp failure
  leaves the entry showing its block number only. Entries merged
  newest-first, deduped by tx hash + log index, capped at 50.
- **Entry rendering:** human label ("Free mint — token #N", "Paid mint —
  token #N (0.001 BNB)", "Transfer — token #N", "Paused", "Unpaused",
  "Withdrawal — X BNB", "Base URI set", "Base URI frozen", "Ownership
  transferred"), truncated wallet/token detail, block time (or block
  number), BscScan tx link.

## 3. What the public RPCs actually do with eth_getLogs (evidence, not assumption)

Probed with a bounded range (latest block, last 10,000 blocks, zero
address) via curl through the egress proxy:

| RPC | Worker probe (18 Nov ~18:29 UTC) | Coordinator re-probe (~18:31 UTC) |
|---|---|---|
| PublicNode `https://bsc-rpc.publicnode.com` | **WORKS** — `{"jsonrpc":"2.0","id":2,"result":[]}` | **REJECTS, twice incl. retry** — `{"error":{"code":-32005,"message":"Rate limit exceeded. To obtain higher limits, please request a personal token or a dedicated node: https://www.allnodes.com/publicnode"}}` |
| Dataseed `https://bsc-dataseed.bnbchain.org` | **REJECTS** — `{"error":{"code":-32005,"message":"limit exceeded"}}` | **REJECTS, same** — `{"error":{"code":-32005,"message":"limit exceeded"}}` |

Additional observations (worker probe): PublicNode `eth_getLogs` with
`fromBlock: "0x0"` (unbounded) is rejected with `-32602 "Archive requests
require a personal token"` — confirming the bounded 10,000-block range is
the right call. PublicNode `eth_blockNumber` was once rate-limited on
first attempt but succeeded on retry.

**Conclusion:** history works today through the fallback transport's
primary (PublicNode) when it is not rate-limiting, and dataseed
consistently rejects log queries. Free-tier `eth_getLogs` is flaky by
nature — sometimes it works, sometimes the same request is rate-limited
minutes later. The feed's design handles exactly this: if the RPC rejects
the query, the hook catches it and the feed shows an honest "Event
history unavailable from this RPC — showing live events only" note and
keeps working live-forward. History is NEVER faked and an empty feed is
NEVER presented as if nothing happened.

## Verification (all local — no real chain, no BNB spent)

- `npx tsc --noEmit` → **exit 0**.
- `npm run build` → **exit 0** (vite build, 11.90 s after the lint fix).
  Bundle grepped: contains "Live on BSC Mainnet", "recent activity
  appears here", "Event history unavailable", "No contract activity yet".
- `npm run lint` (oxlint) → **0 errors, 1 warning** (the pre-existing
  intentional WalletModal set-state-in-effect warning from Stage 4).
- **Anvil integration test — 93 PASS, 0 FAIL, "ALL CHECKS PASSED", exit
  0** (coordinator's own fresh run: anvil started, contract deployed
  with the Stage 9 deploy script to local anvil at
  `0x5fbdb2315678afecb367f032d93f642f64180aa3`, owner
  `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`, base URI
  `https://example.invalid/metadata/`). The 58 Stage 5 checks still pass;
  the 35 new Stage 6 lines cover: event-log assertions over the full
  range (FreeMinted ×1 — minter acct1, tokenId 1; PaidMinted ×3 —
  tokenIds 2,3,4, minter acct2, 0.001 ETH each; Transfer ×4 — from zero
  address, to acct1/acct2/acct2/acct2; Paused + Unpaused — account owner;
  Withdrawn — to owner, 0.003 ETH; BaseURISet + BaseURIFrozen); a live
  `watchContractEvent` Transfer assertion around a real `transferFrom`
  (token 1, acct1 → acct2, callback fired with the right args,
  `ownerOf(1) == acct2`); final stats reads (totalMinted 4, freeMinted 1,
  paidMinted 3, remainingFree 1110, remainingPaid 4441, paused false,
  baseURIFrozen true). Anvil stopped afterwards; deployer key extracted
  from the anvil startup log, never typed from memory, never printed, and
  the temp key file removed.

## One real issue found and fixed during central verification

**New lint warning — `react-hooks(exhaustive-deps)` in
`useActivityFeed.ts`.** The first central build passed but lint showed 2
warnings: the pre-existing WalletModal one plus a new one — the `useMemo`
for merged entries depended on `historyEntries`, which is
`history.data?.entries ?? []`, a fresh array every render, so the memo
never memoized. Fixed by depending on `history.data` (the stable
react-query result object, which only changes identity when the query
actually refetches) and deriving the entries inside the memo. Lint is
back to the single pre-existing warning; tsc and build re-run clean.

## States a user sees before deployment (contract not deployed)

| Section | State |
|---|---|
| Stats | Badge amber "◆ Contract not deployed"; 5 supply cards + contract address read "CONTRACT NOT DEPLOYED"; collection size (design) 5,555; floor price "DATA UNAVAILABLE" |
| Recent activity | "CONTRACT NOT DEPLOYED — recent activity appears here after the Stage 9 deployment." No RPC calls are made. |
| Mint / My NFTs / Admin / prompt center | Unchanged from Stage 5 |

When deployed, the states become: stats show live on-chain counts and
the badge flips emerald; the feed shows "Loading recent activity…" while
history loads, "No contract activity yet." when deployed with no events,
the honest "Event history unavailable from this RPC — showing live events
only." note when the RPC rejects log queries, and the newest-first list
otherwise.

## How to verify in the browser

1. Deploy the preview the same way as Stages 4–5 (slim `dist/` to the
   `aurum-agents-preview` Pages project — artwork/metadata stay out
   until Stage 8).
2. Open the preview; nav now has an "Activity" link between "Status"
   and "Mint".
3. Stats still read CONTRACT NOT DEPLOYED; the Activity section reads
   CONTRACT NOT DEPLOYED. Nothing else on the page changes.
4. Live events / history cannot be exercised in a browser until the
   contract exists on-chain (Stage 9). The event wiring is verified by
   the anvil test (same events, same decode rules) plus a clean build —
   not by a real browser session yet.

## Open issues

1. **No real-browser test of live events / history yet.** Needs a
   deployed contract (Stage 9). The anvil test is the verification so
   far.
2. **Free-tier history is flaky on mainnet.** PublicNode rate-limited
   `eth_getLogs` twice in a row on the coordinator's re-probe after
   succeeding once for the worker. On mainnet the feed will sometimes
   show the honest "history unavailable" note even though the code is
   correct. A dedicated RPC (or a paid tier) would fix it — that is a
   Stage 8/9 decision, not a code fix. The live subscription path does
   not depend on `eth_getLogs` history and keeps working.
3. **Nine polling subscriptions.** The feed opens one
   `useWatchContractEvent` subscription per event (9 total); on HTTP
   transports viem polls each filter. Fine at current scale, but if the
   public RPC rate-limits polling, consolidating to fewer subscriptions
   is the lever.
4. **Anvil test is NOT idempotent** — re-runs need a fresh anvil +
   fresh deploy (the script asserts a pristine contract state, and the
   §6.2 transfer is one-way within a run).
5. **CSP note (no action needed):** `connect-src` already covers both
   RPC hosts (Stage 4 fix), and `getLogs` / polling go to those same
   hosts — no new CSP entries were required for Stage 6.

## What Stage 6 did NOT do

- No deployment to any real chain, no BNB spent, no accounts created.
- No fake data: every not-yet-on-chain value reads CONTRACT NOT
  DEPLOYED / CONNECT WALLET / DATA UNAVAILABLE, and event history is
  either real logs or an honest "unavailable" state. The anvil contract
  address is a local-test value only and appears nowhere in the app.
- No network switching, no auto-signing; the feed is read-only and
  never signs anything.
