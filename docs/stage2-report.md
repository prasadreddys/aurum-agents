# AURUM AGENTS — Stage 2 Completion Report

**Date:** 2026-11-18
**Scope:** Brand identity, generative artwork system, metadata, website template.
**Status:** COMPLETE. Contract not deployed; no wallet wiring; no minting live.

## Deliverables

| # | Deliverable | Location |
|---|---|---|
| 1 | Brand identity doc | `docs/brand.md` |
| 2 | Generative artwork system + 5,555 artworks | `artwork/generate.py`, `artwork/images/*.webp` |
| 3 | Metadata (5,555 JSON files) | `metadata/*.json` (+ `generate_metadata.py`, `validate.py`) |
| 4 | Website template | `frontend/` (Vite + React 19 + TS + Tailwind v4.3.3) |
| 5 | Repo README | `README.md` |

## Artwork — verified numbers

- **Count:** 5,555 files, token IDs 1–5,555, exactly one per token.
- **Uniqueness:** 5,555 / 5,555 distinct SHA-256 hashes — zero duplicates.
- **Format:** WebP, 768×768, quality 82.
- **Sizes:** min 10,384 B · avg 12,672 B · max 17,374 B · **total 67.1 MB**.
  Hard cap was 500 KB/file; largest file is 17.4 KB. Total is 2.2% of the
  ~3 GB budget and 0.7% of the 10 GB Cloudflare R2 free tier.
- **Determinism:** fixed seeds (`SEED_RARITY = 20261118`, `SEED_TOKEN = 1337`);
  re-running the generator reproduces byte-identical files.
- **Generation time:** ~24.6 min at ~3.7 img/s (local, free tools only).

## Rarity distribution — verified exact

| Tier | Count | Share | Gold edition |
|---|---|---|---|
| Common | 3,055 | 55.0% | — |
| Uncommon | 1,389 | 25.0% | — |
| Rare | 667 | 12.0% | — |
| Epic | 333 | 6.0% | 33 (10% of Epic) |
| Legendary | 111 | 2.0% | all 111 |
| **Total** | **5,555** | | **144 Aurum Gold** |

## Metadata — verified

- 5,555 files, all parse as JSON; token IDs match filenames; all required
  fields present (`name`, `description`, `image`, `attributes` with all 8
  traits). Validator: `metadata/validate.py` → **PASSED, 0 errors**.
- Image field is the placeholder `{BASE_URI}/<tokenId>.webp` — no hardcoded
  address, no fake live URL. Base URI substitution happens at Stage 8.

## Frontend — verified

- Stack: Vite 8.3.6, React 19.3.1, TypeScript 7.0.2, Tailwind CSS 4.3.3
  (`@tailwindcss/vite`).
- `npm run build` → **exit 0** (tsc + vite build, 5.9 s). JS 251.9 KB
  (76.8 KB gzip), CSS 32.5 KB.
- Production build served with `vite preview` and verified over HTTP:
  index 200, `/gallery-index.json` 200 (5,555 entries),
  `/artwork/108.webp` 200, `/metadata/108.json` 200 (placeholder intact),
  JS bundle 200.
- Sections: animated hero (canvas gold particles + featured Legendary
  #108), collection status (CONTRACT NOT DEPLOYED), free/paid mint panels
  (UI only, disabled; paid quantity selector 1–10 with live total),
  gallery (search by token ID, rarity filter, 24/page, detail modal with
  traits + metadata link), prompt center (10 prompts, copy buttons),
  footer. Responsive mobile + desktop.
- `public/_headers` ships Cloudflare Pages security headers.
- Two build issues found and fixed during Stage 2: (1) the scaffold's
  `vite.config.ts` did not register the Tailwind plugin, so no utilities
  were generated — fixed by adding `@tailwindcss/vite`; (2) the asset
  copy step also copied the metadata scripts into `public/metadata` —
  fixed to copy `*.json` only.

## Wallet re-scope — as approved (Blocker B1 resolved 2026-11-18 ~22:04 IST)

- **Binance Web3 Wallet first in the dApp** (WalletConnect v2 + injected
  `window.binancew3w.ethereum`); wallet wiring itself is Stage 4, so the
  header Connect button is present but disabled with a Stage 4 note.
- **Agentic Wallet as a clearly-labelled copy-paste prompt track** for the
  user's own AI agent; no "Connect Binance Agent Wallet" button anywhere.
- **Developer-mode warning** shown on the two mint prompts (3, 4) and in
  the prompt-center intro, quoting Binance's asset-loss warning and the
  "Require App confirmation" setting.
- Read prompts (2, 5–9) are marked "Requires deployed contract".

## Open items for Stage 5

1. **Live contract reads** — replace CONTRACT NOT DEPLOYED stats with real
   reads once Stage 9 deploys (contract address, `totalSupply`,
   `freeMinted`/`paidMinted`, `hasClaimedFree`, `paidMintedBy`).
2. **Wallet wiring (Stage 4)** — wagmi 3 + viem 2, injected connectors
   (MetaMask, `window.binancew3w.ethereum`), WalletConnect v2 (needs the
   free Reown project ID, Blocker B5); enable the mint buttons.
3. **Mint transactions (Stage 5)** — free/paid mint calls, tx status +
   BscScan links, gallery ownership (minted vs unminted from chain).
4. **Admin panel (Stage 5)** — owner-gated, pause/unpause, withdraw,
   metadata status.
5. **Cloudflare deploy (Stage 8)** — needs the project domain (B2) and the
   R2 payment-method decision (B4); substitute `{BASE_URI}`.
6. **Mainnet deploy (Stage 9)** — deployer wallet + gas quote + explicit
   owner approval (B3); BscScan verification key check (B6).

## What Stage 2 did NOT do

- No contract code (parallel Stage 3 agent owns `contracts/` — untouched).
- No deployment, no spending, no external accounts, no paid services.
- No fake data anywhere: every not-yet-on-chain value reads
  CONTRACT NOT DEPLOYED / DATA UNAVAILABLE / CONNECT WALLET.
