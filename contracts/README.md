# AURUM AGENTS — Contracts

ERC-721 NFT minting contract for BNB Smart Chain Mainnet (chain 56).
5,555 NFTs: 1,111 free (1/wallet) + 4,444 paid at 0.001 BNB (max 10/wallet).

**Nothing is deployed. No BNB spent. Deployment is locked until the owner
approves it (Stage 9).**

## Quick start

```bash
export PATH="$PATH:$HOME/workspace/foundry/bin"
forge build    # solc 0.8.38, OpenZeppelin 5.6.1, Foundry 1.9.0
forge test     # 37 tests (30 unit + 7 BSC mainnet-fork), all passing
forge snapshot # gas figures in .gas-snapshot
```

## Layout

- `src/AurumAgents.sol` — the contract
- `test/AurumAgents.t.sol` — unit tests
- `test/AurumAgentsFork.t.sol` — BSC mainnet-fork tests (pinned block 134344538)
- `script/Deploy.s.sol` — deployment script, prepared only, **never executed**
- `docs/contracts.md` — full documentation: API, gas, security, deployment guide

## Rules (enforced on-chain)

- Free mint: 1 per wallet, while the 1,111 free allocation lasts.
- Paid mint: 1–10 per call, max 10 per wallet, exact payment `qty × 0.001 BNB`.
- No owner mint function. Owner: pause/unpause, base-URI set/freeze, withdraw.
