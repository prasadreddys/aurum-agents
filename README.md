# AURUM AGENTS — Premium NFT Minting Platform

**Status: Stage 2 complete (brand, artwork, website template). Contract not
deployed. No NFTs minted. No wallet wiring yet.**

AURUM AGENTS is a 5,555-piece ERC-721 NFT collection on **BNB Smart Chain
Mainnet only (chain 56)**: 1,111 free mints (1 per wallet) + 4,444 paid mints
at 0.001 BNB (max 10 per wallet, 11 combined). Black-and-gold premium
aesthetic, Binance-inspired.

> Honesty rule: this repo contains **no fake on-chain data**. Anything that
> must come from the blockchain reads `CONTRACT NOT DEPLOYED` or
> `DATA UNAVAILABLE` until the contract is deployed on mainnet (Stage 9).
> The artwork and metadata here are pre-mint assets, not minted tokens.

## Folder map

| Path | What it is |
|---|---|
| `docs/brand.md` | Brand identity: name, colours, typography, visual direction, rarity tiers |
| `artwork/generate.py` | Deterministic seeded artwork generator (Python + PIL/numpy, local only) |
| `artwork/images/` | 5,555 generated artworks (`<tokenId>.webp`, 768×768 WebP) |
| `artwork/manifest.json` | Full trait manifest (one entry per token, with SHA-256) |
| `artwork/gallery-index.json` | Compact index consumed by the frontend gallery |
| `metadata/generate_metadata.py` | Metadata generator (reads the manifest) |
| `metadata/validate.py` | Stage 2 validator (counts, hashes, sizes, JSON, rarity) |
| `metadata/<tokenId>.json` | 5,555 OpenSea-compatible metadata files |
| `frontend/` | Vite + React 19 + TypeScript + Tailwind v4 website |
| `frontend/scripts/copy-assets.mjs` | Copies artwork/metadata into `frontend/public/` for dev/build |
| `contracts/` | **Owned by the parallel Stage 3 agent — do not touch from Stage 2** |

## Rarity distribution (fixed, seeded)

| Tier | Count | Share |
|---|---|---|
| Common | 3,055 | 55% |
| Uncommon | 1,389 | 25% |
| Rare | 667 | 12% |
| Epic | 333 | 6% |
| Legendary | 111 | 2% |

Edition: `Aurum Gold` = all 111 Legendary + 33 Epic (144 total). All others
are `Standard`. Rarity does not change mint price or limits.

## Run the artwork generator

```bash
cd artwork
python3 generate.py            # all 5,555 tokens (~25–30 min, ~3–4 img/s)
python3 generate.py --end 25   # test batch only
```

Requirements: Python 3.10+, `Pillow`, `numpy` (both already installed on the
dev VM). No network, no paid APIs. Fixed seeds (`SEED_RARITY = 20261118`,
`SEED_TOKEN = 1337`) — re-running reproduces byte-identical files. Output:
768×768 WebP, quality 82; target ≤200 KB each, hard cap 500 KB each;
collection total ≈ 70 MB (well under the ~3 GB budget and the 10 GB
Cloudflare R2 free tier).

## Generate metadata

```bash
cd metadata
python3 generate_metadata.py  # reads artwork/manifest.json, writes 5,555 JSON files
python3 validate.py            # full validation — must exit 0
```

Metadata image field uses the placeholder `{BASE_URI}/<tokenId>.webp`.
Substitute the real base URI at deploy time (Stage 8: R2 public URL, or
Cloudflare Pages URL as fallback). Never hardcode a contract address or a
fake live URL.

## Run the website locally

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173 (assets auto-copied from artwork/ + metadata/)
npm run build    # tsc + vite build; exit 0 required
npm run preview  # serve the production build locally
```

The site is a static Vite build: hero, collection status (CONTRACT NOT
DEPLOYED), free/paid mint panels (UI only, disabled until a contract exists),
a gallery (search by token ID, filter by rarity, 24 per page, token detail
modal), a Binance Agent Wallet prompt center (copy-paste prompts for the
user's own AI agent, with the Developer-mode warning on mint prompts), and a
footer. No wallet wiring yet — that is Stage 4.

## Wallet re-scope (Stage 1 finding)

Binance **Agentic** Wallet is not a dApp wallet: it has no browser provider,
no website connect flow, and no JavaScript SDK, and its skill has no NFT mint
command. The dApp-connectable wallet is **Binance Web3 Wallet**
(WalletConnect v2 + injected `window.binancew3w.ethereum`), which is listed
first in the UI. The Agentic Wallet is offered as a labelled agent-prompt
track; mints through it need Developer mode in the Binance App (with
Binance's asset-loss warning shown). See `research/stage1-report.md` §1.5/§1.6
in the goal workspace.

## Open items (for later stages)

- **Stage 3 (parallel):** contracts + Foundry mainnet-fork tests.
- **Stage 4:** wallet wiring — needs the owner's re-scope decision (Blocker
  B1) and a free Reown Cloud project ID (B5).
- **Stage 5:** live contract reads, mint transactions, admin panel.
- **Stage 8:** Cloudflare deploy — needs the project domain (B2) and the R2
  payment-method decision (B4).
- **Stage 9:** mainnet deployment — needs the deployer wallet, a live gas
  quote, and explicit owner approval (B3); BscScan verification key check
  (B6).

## Rules that never change

- Mainnet only (56). No testnet, no simulated transactions.
- No fake data, no fake statistics, no hardcoded deployed addresses.
- No spending, no paid services, no deployment without explicit approval.

## Repository layout
- `contracts/` — AurumAgents ERC-721 contract (Foundry). Run `forge install` to fetch OpenZeppelin, then `forge test`.
- `frontend/` — mint site (Vite + React + wagmi), deployed to Cloudflare Pages.
- `docs/` — stage reports, deployment runbook, brand assets.
- NFT artwork and metadata (5,555 items) are generated assets served from Cloudflare Pages, not stored in this repo.
