# AURUM AGENTS — Remix Deploy Guide (Stage 9)

**Date:** 19 Nov 2026. **Status:** PACKAGE READY — the contract is proven
to deploy from Remix with byte-identical code to the audited forge
build. **Nothing is deployed yet.** Deployment still needs: the
owner's wallet connected in Remix (item 1), the owner address
(item 2), the audit decision (item 3), the Etherscan key (item 4),
and the owner's explicit go-ahead at deploy time.

## 1. Why Remix

The owner chose to deploy from their own wallet, and the key never
leaves their wallet. Forge on this VM cannot sign with a key it does
not hold, so the deploy runs in the owner's browser via Remix IDE +
MetaMask ("Injected Provider"). The contract is deployed exactly as
audited — see §2 for the proof.

## 2. The flattened contract (proven identical)

- **File:** `repo/contracts/flattened/AurumAgents.flattened.sol`
  (4,706 lines, 175 KB, one SPDX line) — produced by
  `forge flatten src/AurumAgents.sol`. It inlines the repo's pinned
  OpenZeppelin **v5.6.1**; there are no external imports left, so
  Remix cannot pull a different library version by accident.
- **Proof (19 Nov 2026):** the flattened file was compiled standalone
  in a scratch foundry project (solc 0.8.38, optimizer on, 200 runs,
  via_ir off) and its creation bytecode is **byte-identical** to the
  audited forge build (9,759 bytes; identical ignoring only the
  CBOR metadata hash, which differs whenever the source file layout
  differs). Deployed bytecode identical too.

## 3. Remix settings (must match exactly)

| Setting | Value |
|---|---|
| Compiler version | **0.8.38** (exact — pick it in Remix's compiler dropdown) |
| Language | Solidity |
| EVM version | Default for 0.8.38 (same as the forge build; see note below) |
| Optimizer | **Enabled, 200 runs** |
| Contract | `AurumAgents` (from `AurumAgents.flattened.sol`) |

Note on EVM version: `foundry.toml` sets no `evm_version`, so the
forge build used solc 0.8.38's default. Remix's default for 0.8.38
is the same. The final proof is BscScan verification after deploy:
if verification succeeds with these settings, the deployed bytecode
matches the audited build.

## 4. Constructor arguments

Deploy with exactly these two arguments, in this order:

1. `initialOwner` — the owner address (item 2: 2-of-3 Safe multisig
   address, recommended, or a single owner address).
2. `initialBaseURI` — `"https://aurumagents.pages.dev/metadata/"`

In Remix's "Deploy" panel, paste them as:
`"<OWNER_ADDRESS>", "https://aurumagents.pages.dev/metadata/"`

## 5. Deploy steps (owner's browser, after approval)

1. Remix is already open (browser task, 19 Nov ~09:47 IST) with the
   owner's wallet connected on BSC Mainnet (chain 56). Confirm the
   connected address is the funded deployer wallet (≥0.002 BNB).
2. Upload `AurumAgents.flattened.sol` into the Remix workspace
   (File Explorer → upload). Compile with the §3 settings; the
   compile must succeed with no errors.
3. Open "Deploy & Run Transactions", set Environment to
   **Injected Provider - MetaMask**, confirm Remix shows BSC
   Mainnet / chain 56 and the deployer address.
4. Select contract `AurumAgents`, enter the §4 constructor args,
   click Deploy. **Read the MetaMask confirmation before signing:**
   it must show a contract creation (no "to" address), ~2.16M gas,
   ~0.000108 BNB at 0.05 gwei. If anything looks different, reject
   it and stop.
5. Record the deployed contract address + transaction hash
   immediately (report + GOAL.md). Check the address on BscScan.
6. Verify the source on BscScan (Remix's Etherscan verification
   plugin, or the BscScan web form) with the free Etherscan API key
   (item 4), compiler 0.8.38, optimizer on, 200 runs. Fallback:
   Sourcify (no key). Verification passing is the proof the
   deployed code is the audited code.

## 6. What the deploy does — and does not do

- Deploys the contract only. It mints NOTHING and transfers NOTHING.
- The only BNB spent is the deployment gas (~$0.06 at the quoted
  0.05 gwei; re-quote live at deploy time).
- After deploy: set `VITE_CONTRACT_ADDRESS` in `frontend/.env`,
  rebuild, redeploy the site (preview first, then production), and
  live-verify the mint flow. That is a separate step, after the
  contract address is recorded.
