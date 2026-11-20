# AURUM AGENTS — Stage 5 Completion Report

**Date:** 2026-11-18
**Scope:** Mint dashboard wiring (free + paid mint transactions), NFT
gallery ownership ("My NFTs"), admin panel (owner-gated controls).
**Status:** COMPLETE. Contract not deployed; every mint/admin control
stays disabled until Stage 9, and every section renders its honest
not-deployed state.

## What was built

| # | Deliverable | Location |
|---|---|---|
| 1 | Contract write hook — tx state machine (idle → awaiting → pending → confirmed / failed) | `frontend/src/hooks/useAurumWrites.ts` |
| 2 | Transaction status component (BscScan link on confirmation) | `frontend/src/components/TxStatus.tsx` |
| 3 | Mint panels wired to the contract (freeMint + paidMint) | `frontend/src/components/MintPanels.tsx` |
| 4 | Owned-token hook — enumeration + tokenURI + metadata fetch with local fallback | `frontend/src/hooks/useOwnedTokens.ts` |
| 5 | "My NFTs" ownership view | `frontend/src/components/MyNFTs.tsx` |
| 6 | Owner-gated admin panel (pause, withdraw, baseURI, freeze) | `frontend/src/components/AdminPanel.tsx` |
| 7 | `baseURIFrozen` added to collection reads | `frontend/src/hooks/useAurumReads.ts` |
| 8 | New sections + nav wired in | `frontend/src/App.tsx` |
| 9 | Anvil integration test extended (32 → 58 checks) | `frontend/scripts/anvil-integration-test.mjs` |

## 1. Mint flow

`useContractWrite()` wraps wagmi `useWriteContract` +
`useWaitForTransactionReceipt` and exposes one `TxFlow` per action:
`phase` (`idle` | `awaiting` | `pending` | `confirmed` | `failed`),
`hash`, `error` (wagmi `shortMessage`, capped at 240 chars),
`isBusy`, `write`, `reset`. On a successful receipt all react-query
queries are invalidated so eligibility/supply reads refresh.
`TxStatus` renders the phase and, on confirmation, a BscScan tx link
(`https://bscscan.com/tx/<hash>`).

**Free mint** — `freeMint()`, 0 BNB. Button enabled only when deployed
&& connected && chain 56 && not paused && eligible && not busy.
Eligibility comes from the existing `useFreeMintStatus` (already claimed
→ "Already claimed"; sold out → "FREE MINT SOLD OUT"). A zero-BNB
wallet gets a muted gas warning ("you need a small amount of BNB for
gas") — the mint itself costs 0 BNB.

**Paid mint** — `paidMint(qty)` with exact value
`parseEther((qty × 0.001).toFixed(3))`. Quantity is capped at
`min(10, paidMintRemaining)`; at 0 remaining the selector disables
with "You have reached the 10 paid mint limit for this wallet."
Insufficient-balance guard disables the button with "Insufficient BNB
— you need {total} BNB plus gas." Both panels stay disabled while
CONTRACT NOT DEPLOYED, wallet disconnected, or wrong chain, with the
reason shown under the button (the Stage 4 not-deployed copy is
preserved verbatim). After confirmation a Dismiss button resets the
flow.

## 2. "My NFTs" ownership view

`useOwnedTokensMeta(address)` reuses the Stage 4 `useOwnedTokenIds`
(balanceOf + tokenOfOwnerByIndex, capped at 100), then reads
`tokenURI` per token and fetches each metadata JSON (8 s timeout;
any failure resolves to `metadata: undefined`, never throws). The
local `/gallery-index.json` is attached as a fallback for
rarity/traits. `MyNFTs` renders:

- Disconnected → "CONNECT WALLET — connect a wallet to see the NFTs
  it owns."
- Connected, not deployed → "CONTRACT NOT DEPLOYED — ownership is
  verified on-chain after the Stage 9 deployment."
- Deployed + loading → "Loading your NFTs…"
- Deployed + owns none → "This wallet owns no AURUM AGENTS NFTs yet."
- Deployed + owns N → grid of owned cards. Artwork is the local
  `/artwork/<id>.webp` (the identical asset the on-chain metadata will
  serve; same-origin, so no CSP issue), with rarity badge, edition,
  BscScan token link, and the truncated on-chain tokenURI + "Metadata ↗"
  link. When the on-chain metadata fetch fails, the card says so
  ("Metadata from local index — on-chain metadata not reachable yet").
  Token IDs are rendered only from the on-chain enumeration — never
  from the local index.

## 3. Admin panel

Gating, in order: not deployed → CONTRACT NOT DEPLOYED panel;
deployed + disconnected → CONNECT WALLET panel; deployed + connected
but not the owner → "You are not the contract owner." (connected and
owner addresses shown, owner linked to BscScan) and **no controls
render**; deployed + connected as owner (case-insensitive compare) →
controls. A "Loading owner…" panel avoids flashing the not-owner state
at the real owner while the read loads.

- **Pause / Unpause** — live `paused` state; calls `pause()` /
  `unpause()`. Note: pausing stops mints; existing tokens still
  transfer.
- **Withdraw** — contract BNB balance via `useBalance` on the contract
  address; button "Withdraw {balance} BNB to owner"; disabled with
  "Contract balance is 0 BNB — nothing to withdraw." at zero.
- **Base URI** — input + "Set base URI" calling `setBaseURI()`.
  Button disabled unless the value is non-empty and ends with `/`
  (tokenURI is baseURI + `"<id>.json"`). Disabled once frozen.
- **Freeze base URI** — two-step confirm ("Click again to confirm
  freeze" + Cancel) with a prominent one-way/permanent warning;
  amber-tinted danger button; fully disabled once frozen.
- **Metadata status** — baseURI value ("Not set" when empty), frozen
  Yes/No, paused Yes/No, total minted — all real reads.

Every admin action is its own `useContractWrite` instance + `TxStatus`
(BscScan link on confirmation), disabled unless deployed && owner &&
chain 56 && not busy.

## Verification (all local — no real chain, no BNB spent)

- `npm run build` → **exit 0** (tsc clean + vite build, 13.25 s).
  Bundle: index chunk 417.75 KB (122.85 KB gzip) + core/WC chunks.
- `npm run lint` (oxlint) → **0 errors**, 1 warning (the pre-existing
  intentional WalletModal set-state-in-effect warning from Stage 4).
- Built bundle grepped: contains "My NFTs", "CONTRACT NOT DEPLOYED",
  "You are not the contract owner", `freezeBaseURI`, `setBaseURI`.
- **Anvil integration test — 58/58 PASS, exit 0** (coordinator's own
  fresh run, contract deployed with the Stage 9 deploy script to local
  anvil at `0x5FbDB2315678afecb367f032d93F642f64180aa3`, owner
  `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`, base URI
  `https://example.invalid/metadata/`). The 32 Stage 4 checks still
  pass; the 26 new Stage 5 checks cover: ownership enumeration for
  the wallet that minted 3 (balanceOf 3, tokenOfOwnerByIndex → 2, 3,
  4); non-owner pause reverts (`OwnableUnauthorizedAccount`); owner
  pause → `paused` true; freeMint and paidMint revert while paused
  (`EnforcedPause`); owner unpause → `paused` false; withdraw drains
  the 0.003 ETH contract balance to 0; `tokenURI(1)` =
  `https://example.invalid/metadata/1.json`; non-owner setBaseURI
  reverts; owner setBaseURI to `https://aurum.test/meta/` updates
  baseURI and `tokenURI(1)`; `freezeBaseURI` sets `baseURIFrozen`
  true; setBaseURI after freeze reverts (`BaseURIFrozenAlready`).
  Anvil stopped afterwards; temp logs removed. The deployer/owner key
  was extracted from the anvil startup log programmatically, never
  typed from memory and never printed (only the address was logged).

## Two real issues found and fixed during central verification

1. **`receipt.status` is not the transaction status.** The first
   build failed: `useWaitForTransactionReceipt` returns a react-query
   result whose `status` is `"error" | "pending" | "success"` — the
   transaction outcome lives on `receipt.data.status`
   (`"success" | "reverted"`). Fixed in `useAurumWrites.ts` to read
   `receipt.data?.status` for the reverted/confirmed derivation and
   the post-mint invalidation effect.
2. **`TxFlow.write` type vs the registered wagmi config.** The
   interface typed `write` as
   `ReturnType<typeof useWriteContract>["writeContract"]`, which picks
   wagmi's generic overload — not assignable to the mutate function
   typed with the app's registered config. Fixed by deriving the type
   from the hook itself: `export type TxFlow = ReturnType<typeof
   useContractWrite>` (the hook no longer annotates its own return
   type). No casts; call sites typecheck against the registered
   config.
3. **MintPanels qty-clamp effect (lint warning).** The paid quantity
   was clamped in a `useEffect`, which oxlint flags. Refactored to
   derive `effectiveQty` during render; the stored qty is now only
   written by the stepper/slider handlers. Lint is back to the single
   pre-existing warning.

## States a user sees before deployment (contract not deployed)

| Section | Disconnected | Connected |
|---|---|---|
| Mint — free | "Disabled — contract not deployed. Connect a wallet to mint."; eligibility "CONNECT WALLET" | "Disabled — contract not deployed."; eligibility "CONTRACT NOT DEPLOYED" |
| Mint — paid | Same not-deployed note | Same not-deployed note; qty selector live, total visible |
| My NFTs | "CONNECT WALLET — connect a wallet to see the NFTs it owns." | "CONTRACT NOT DEPLOYED — ownership is verified on-chain after the Stage 9 deployment." |
| Admin | "CONTRACT NOT DEPLOYED — admin controls appear after the Stage 9 deployment." | Same CONTRACT NOT DEPLOYED panel (owner check cannot run without a contract) |
| Stats / prompt center | Unchanged from Stage 4 | Unchanged from Stage 4 |

## How to verify in the browser

1. Deploy the preview the same way as Stage 4 (slim `dist/` to the
   `aurum-agents-preview` Pages project — artwork/metadata stay out
   until Stage 8).
2. Open the preview; nav now has "My NFTs" and "Admin" links.
3. Disconnected: mint buttons disabled with the not-deployed notes;
   My NFTs shows CONNECT WALLET; Admin shows CONTRACT NOT DEPLOYED.
4. Connect MetaMask (already verified on BSC 56): free-panel
   eligibility reads "CONTRACT NOT DEPLOYED"; paid note reads
   "Disabled — contract not deployed."; My NFTs reads CONTRACT NOT
   DEPLOYED; Admin still CONTRACT NOT DEPLOYED.
5. Live mint/admin clicks cannot be exercised in a browser until the
   contract exists on-chain (Stage 9). The wagmi write path is
   verified by the anvil test (same functions, same value rules) plus
   a clean build — not by a real browser click yet.

## Open issues

1. **CSP + metadata host (Stage 8).** `public/_headers` `connect-src`
   currently allows only the two BSC RPC hosts and the WalletConnect
   relay. Once a metadata base URI is chosen, its host must be added
   to `connect-src` or the in-browser tokenURI metadata fetch will be
   blocked (MyNFTs degrades gracefully to the local index, so the view
   still works).
2. **StatsPanel still shows CONTRACT NOT DEPLOYED by design.**
   Wiring live stats is Stage 6's scope; Stage 5 deliberately left
   the stats/prompt-center behaviour untouched.
3. **No real-browser click test of mint/admin yet.** Needs a deployed
   contract (Stage 9). The anvil test is the verification so far.
4. **Anvil test is NOT idempotent** — re-runs need a fresh anvil +
   fresh deploy (the script asserts a pristine contract state).
5. **pkill trap (re-learned).** A `pkill -f` pattern in the same exec
   whose command line contains the literal pattern kills the exec
   itself. Kill stale anvil in a SEPARATE exec from the one that
   starts anvil, using the bracket trick (`anvi[l]`).

## What Stage 5 did NOT do

- No deployment to any real chain, no BNB spent, no accounts created.
- No fake data: every not-yet-on-chain value reads CONTRACT NOT
  DEPLOYED / CONNECT WALLET / DATA UNAVAILABLE. The anvil contract
  address is a local-test value only and appears nowhere in the app.
- No network switching, no auto-signing; transactions only fire from
  an explicit user click.
