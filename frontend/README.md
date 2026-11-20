# AURUM AGENTS — Frontend

Premium NFT minting website (Stage 2 template + Stage 4 wallet wiring).
Vite 8 + React 19 + TypeScript + Tailwind CSS v4. BNB Smart Chain
Mainnet (chain 56) only.

## Run locally

```bash
cp .env.example .env   # then fill in the values below
npm install
npm run dev            # http://localhost:5173
npm run build          # tsc + vite build (must exit 0)
npm run preview        # serve the production build
```

## Environment (`.env`)

| Variable | Meaning |
|---|---|
| `VITE_WC_PROJECT_ID` | Free Reown Cloud project ID for WalletConnect (public by design). The live value is in `.env` (gitignored); `.env.example` holds the placeholder `your-reown-project-id-here`, which the app treats as "not configured". |
| `VITE_CONTRACT_ADDRESS` | AurumAgents contract on BSC Mainnet. **Empty until Stage 9 deploys it.** While empty, every contract read shows CONTRACT NOT DEPLOYED and minting stays disabled. Never invent an address. |
| `VITE_BSC_RPC_URL` | Public BSC RPC for read-only calls (default `https://bsc-dataseed.bnbchain.org`, no key). |

## Wallet wiring (Stage 4)

- Stack: wagmi 3.7.11, viem 2.56.8, @tanstack/react-query 5, qrcode 1.5.4.
- Config: `src/config/wagmi.ts` — BSC Mainnet only. Connectors in order:
  1. Binance Web3 Wallet (injected `window.binancew3w.ethereum`),
  2. MetaMask (injected),
  3. WalletConnect v2 (only when a real project ID is configured; QR
     pairing URI rendered in the modal).
- There is **no** "Connect Binance Agent Wallet" button: the Agentic
  Wallet has no browser provider (Stage 1 §1.6). It is a copy-paste
  prompt track only — see the prompt center.
- Network switching is never silent: the wrong-network banner asks the
  user to switch via `wallet_switchEthereumChain`.
- Live reads: `src/hooks/useAurumReads.ts` (collection, free mint,
  eligibility, owned token IDs, tx receipt). All gated on the contract
  being deployed.
- Verification scripts (local only, no real chain, no BNB):
  - `scripts/anvil-integration-test.mjs` — contract reads + mints
    against a local anvil node (32 assertions).
  - `scripts/wc-project-id-check.mjs` — checks the Reown project ID
    against the WalletConnect relay (generates a pairing URI, keeps no
    session).

## Layout

- `src/components/` — Hero, StatsPanel, MintPanels, Gallery,
  PromptCenter (+ LiveChecks), WalletModal, WalletButton, NetworkBanner.
- `src/abi/AurumAgents.ts` — contract ABI generated from the Stage 3
  Forge artifact. Regenerate after any contract change.
- `public/artwork/`, `public/metadata/` — copied from `../artwork` and
  `../metadata` at build time by `scripts/copy-assets.mjs`.
- `public/_headers` — Cloudflare Pages security headers.
