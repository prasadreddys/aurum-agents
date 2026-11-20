# AURUM AGENTS — Stage 4 Completion Report

**Date:** 2026-11-18
**Scope:** Wallet integrations (wagmi 3 + viem 2), connect modal, network
handling, prompt-center live reads.
**Status:** COMPLETE. Contract not deployed; minting stays disabled.

## What was built

| # | Deliverable | Location |
|---|---|---|
| 1 | wagmi config — BSC Mainnet (56) only, ordered connectors | `frontend/src/config/wagmi.ts` |
| 2 | Env config with validation (project ID + contract address) | `frontend/src/config/env.ts` |
| 3 | Contract config + BscScan link helpers | `frontend/src/config/contract.ts` |
| 4 | AurumAgents ABI from the Stage 3 Forge artifact (81 entries) | `frontend/src/abi/AurumAgents.ts` |
| 5 | Live-read hooks (collection, free mint, eligibility, owned IDs, tx receipt) | `frontend/src/hooks/useAurumReads.ts` |
| 6 | Connect modal — Binance Web3 Wallet first, MetaMask, WalletConnect + QR | `frontend/src/components/WalletModal.tsx` |
| 7 | Header wallet button (address, BNB balance, panel, disconnect) | `frontend/src/components/WalletButton.tsx` |
| 8 | Wrong-network banner (explicit switch request only) | `frontend/src/components/NetworkBanner.tsx` |
| 9 | Prompt-center live checks (prompts 2, 5, 6, 7, 8, 9, 10) | `frontend/src/components/LiveChecks.tsx` |
| 10 | Providers wired in `main.tsx`; header wired in `App.tsx` | `frontend/src/main.tsx`, `frontend/src/App.tsx` |
| 11 | Local anvil integration test (32 assertions) | `frontend/scripts/anvil-integration-test.mjs` |
| 12 | WalletConnect project-ID relay check | `frontend/scripts/wc-project-id-check.mjs` |
| 13 | Real Reown project ID in `.env` (gitignored); placeholder in `.env.example` | `frontend/.env`, `frontend/.env.example` |

## Connector decision (evidence-based)

The brief allowed Reown AppKit 1.8.23, falling back to wagmi's own
`walletConnect()` connector on evidence of conflict. Evidence found:

1. `npm install @reown/appkit@1.8.23 @reown/appkit-adapter-wagmi`
   resolved the adapter to **2.0.0** — a major version ahead of AppKit
   1.8.23, an untested pairing (AppKit 2.0 is beta per Stage 1).
2. AppKit's modal controls wallet ordering itself, so the required order
   (Binance Web3 Wallet first) and the "needs project ID" state for a
   missing ID cannot be expressed in it.
3. Stage 1 research §3.1 already blesses "a custom modal over wagmi
   connectors" as the alternative.

**Decision: custom modal over wagmi 3.7.11 connectors, no AppKit.**
AppKit packages were uninstalled again. The modal lists, in order:
Binance Web3 Wallet (injected `window.binancew3w.ethereum`), MetaMask
(injected), WalletConnect v2 (QR pairing URI rendered in-modal).
No "Connect Binance Agent Wallet" button exists anywhere — the Agentic
Wallet has no browser provider (Stage 1 §1.6).

## Two real issues found and fixed during Stage 4

1. **Missing WalletConnect provider package.** `@walletconnect/ethereum-provider`
   is an *optional peer dependency* of `@wagmi/connectors` and was not
   installed — the built bundle only referenced it as a dynamic-import
   string, so clicking WalletConnect would have failed at runtime.
   Fixed by installing `@walletconnect/ethereum-provider@^2.21.1`
   (resolved 2.26.0) as a direct dependency and rebuilding.
2. **Anvil deploy used a mistyped test key (from memory).** The first
   local deploy sent from an unfunded address and failed with "Out of
   gas". Fixed by extracting the exact key from the anvil log
   programmatically. The deployed local address
   `0x5fbdb2315678afecb367f032d93F642f64180aa3` is **LOCAL ANVIL ONLY**
   and was never written to `.env` or the app config.

## Verification (all local — no real chain, no BNB spent)

- `npm run build` → **exit 0** (tsc clean + vite build, 12.4 s).
  Bundle: JS 387 KB main chunk (116 KB gzip) + WC provider chunks.
  Two pre-existing warnings, no errors: a `node:worker_threads`
  externalisation note from viem's `ox` internals, and a chunk-size
  warning (>500 KB after minification).
- `npm run lint` (oxlint) → **0 errors**, 1 warning (React
  set-state-in-effect suggestion for the modal's reset-on-open effect —
  intentional, left as is).
- Production build served with `vite preview`: index 200, gallery-index
  200, artwork 200.
- **Anvil integration test — 32/32 PASS** (`scripts/anvil-integration-test.mjs`,
  contract deployed to local anvil at `0x5fbdb2…` with the Stage 9 deploy
  script): reads (name, symbol, supply constants, price, owner, baseURI,
  eligibility, allowance), freeMint + second-claim revert
  (`FreeMintAlreadyClaimed`), paidMint ×3 at exactly 0.003 ETH, under/over-
  payment reverts (`IncorrectPayment`), qty-11 revert (`InvalidQuantity`),
  ownership/enumeration (`tokenOfOwnerByIndex`, `ownerOf`). Anvil and the
  preview server were stopped afterwards.
- **WalletConnect project ID — ACCEPTED BY THE RELAY.**
  `scripts/wc-project-id-check.mjs` with the real ID
  `3fad3d85…` initialised a provider and received a valid `wc:` pairing
  URI (`relay-protocol=irn`). No session was created; the provider was
  disconnected immediately. The ID is also inlined in the built bundle
  (verified by grepping `dist/assets`).
- **Not verified (needs a real browser + wallet):** clicking through the
  modal with Binance Web3 Wallet / MetaMask / a mobile WalletConnect
  wallet, the network-switch prompt, and auto-reconnect persistence.
  A browser task with a real wallet is the remaining live check.

## Environment

- `frontend/.env` (gitignored) now holds the real Reown project ID
  `3fad3d85d10759cb9e8e9f7e3d0be5d7` ("AURUM AGENTS", free Starter,
  account v15099261@gmail.com). The ID is public by design — it ships in
  the client bundle — and is safe to share. `.env.example` carries the
  clearly-marked placeholder `your-reown-project-id-here`; the env
  loader rejects the placeholder and any malformed value (only 32 hex
  chars count as configured).
- `VITE_CONTRACT_ADDRESS` stays **empty** — no contract is deployed.
  Every read panel shows CONTRACT NOT DEPLOYED; mint panels stay
  disabled; the gallery, stats and mint panels are otherwise unchanged
  from Stage 2.

## Open items

1. **Live browser test** — connect a real wallet via the modal (Binance
   Web3 Wallet, MetaMask, mobile WalletConnect) and confirm the balance,
   chain badge, wrong-network banner and disconnect. Needs a browser task.
2. **Mint transactions (Stage 5)** — free/paid mint calls, tx status +
   BscScan links, gallery ownership from chain.
3. **Admin panel (Stage 5)** — owner-gated pause/unpause, withdraw,
   metadata status.
4. **Cloudflare deploy (Stage 8)** — needs the project domain (B2) and
   the R2 payment-method decision (B4); substitute `{BASE_URI}`.
5. **Mainnet deploy (Stage 9)** — deployer wallet + gas quote + explicit
   owner approval (B3); BscScan verification key check (B6).

## What Stage 4 did NOT do

- No deployment to any real chain, no BNB spent, no accounts created
  beyond the pre-existing Reown project (created by the owner).
- No fake data: every not-yet-on-chain value reads CONTRACT NOT
  DEPLOYED / CONNECT WALLET / DATA UNAVAILABLE. The anvil contract
  address is a local-test value only and appears nowhere in the app.

## Follow-up fix (18 Nov 2026, ~23:39 IST) — both live-test findings resolved

1. **BNB balance "—"** — root cause was the Content-Security-Policy in
   `frontend/public/_headers` (`connect-src 'self'`), which blocked every
   off-origin call in the browser; curl from the VM worked fine, so the RPC
   looked healthy. Fix: viem `fallback` transport in `src/config/wagmi.ts`
   (PublicNode first, dataseed second; new `BSC_RPC_FALLBACK_URL` env in
   `src/config/env.ts`, `.env`, `.env.example`) + `connect-src` widened in
   `public/_headers` to both RPC hosts and the WalletConnect relay (the
   same block would have broken WalletConnect pairing). Verified live in
   the owner's Chrome: header "0xa7C3…8Daa 0.0000 BNB", wallet panel
   "BNB balance: 0.0000 BNB".
2. **Stale mint-panel copy** — `MintPanels.tsx` is now `useAccount`-aware:
   paid note reads "Disabled — contract not deployed." while connected
   ("…Connect a wallet to mint." while not); free-panel eligibility reads
   "CONTRACT NOT DEPLOYED" while connected. Stale comments in
   `MintPanels.tsx` / `prompts.ts` updated. Verified live, same session.

Lesson: a CSP with `connect-src 'self'` silently breaks all off-origin
reads — always list RPC + relay hosts in `connect-src`, and keep it in
sync with `env.ts` (noted in the `_headers` file itself).
