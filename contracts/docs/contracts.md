# AURUM AGENTS — Smart Contracts (Stage 3)

**Status:** Stage 3 complete — contracts written, tested, gas-measured, Slither-checked.
**Chain:** BNB Smart Chain Mainnet ONLY (chain ID 56). No testnet contracts.
**Stack:** Solidity 0.8.38, OpenZeppelin Contracts 5.6.1 (pinned tag `v5.6.1`),
Foundry 1.9.0 (`~/workspace/foundry/bin`, installed under `~/workspace` — never `/usr`).
**Nothing deployed. No BNB spent. No keys exist.**

## 1. The contract

`src/AurumAgents.sol` — `AurumAgents`, ERC-721 (`ERC721`, `ERC721Enumerable`,
`Ownable`, `ReentrancyGuard`, `Pausable`), name **AURUM AGENTS**, symbol **AURUM**.

### Allocation rules (fixed constants, enforced on-chain)

| Rule | Value |
|---|---|
| `MAX_SUPPLY` | 5,555 NFTs, token IDs 1–5,555 (sequential) |
| `FREE_SUPPLY` | 1,111 NFTs, price 0 BNB, **1 per wallet** (`hasClaimedFree`) |
| `PAID_SUPPLY` | 4,444 NFTs, price **0.001 BNB** each (`PAID_PRICE`) |
| `MAX_PAID_PER_WALLET` | 10 paid NFTs per wallet (combined max 11 = 1 free + 10 paid) |
| Free and paid counters | Separate: `freeMinted` / `paidMinted`; the allocations can never mix |

### Functions

| Function | Access | Behaviour |
|---|---|---|
| `freeMint()` | anyone, `nonReentrant`, `whenNotPaused` | Mints 1 free NFT. Reverts if the wallet already claimed (`FreeMintAlreadyClaimed`), the free allocation is sold out (`FreeSupplySoldOut`), or max supply is reached. |
| `paidMint(uint256 qty)` | anyone, payable, `nonReentrant`, `whenNotPaused` | Mints `qty` (1–10) paid NFTs. Reverts on bad qty (`InvalidQuantity`), per-wallet cap (`PaidMintLimitExceeded`), paid allocation exhausted (`PaidSupplyExceeded`), max supply (`MaxSupplyReached`), or payment ≠ `qty * 0.001 ether` exactly — over- and underpayment both revert (`IncorrectPayment`). |
| `pause()` / `unpause()` | owner only | Pauses / resumes minting. Transfers of existing tokens are unaffected (pause only gates the mint functions). |
| `setBaseURI(string)` | owner only | Changes the metadata base URI. Reverts once frozen. |
| `freezeBaseURI()` | owner only | Permanently locks the base URI. One-way, cannot be undone. |
| `withdraw()` | owner only, `nonReentrant` | Sends the contract's entire BNB balance to the owner (`.call`, return value checked, `WithdrawFailed` on failure). |
| `transferOwnership(address)` | owner only | OpenZeppelin `Ownable`. Multisig owner recommended (Stage 9). |

**There is NO owner mint function.** The owner cannot mint to themselves or anyone
else outside the free/paid rules above. The only owner powers are pause/unpause,
base-URI set/freeze, withdraw, and ownership transfer.

### Views (for the dashboard / gallery / prompt center)

`totalMinted()`, `remainingFree()`, `remainingPaid()`, `remainingSupply()`,
`paidMintRemaining(address)`, `isFreeMintEligible(address)`, `baseURI()`,
plus the public mappings `hasClaimedFree(address)` and `paidMintedBy(address)`,
and the ERC721Enumerable reads `totalSupply()`, `tokenByIndex(uint256)`,
`tokenOfOwnerByIndex(address, uint256)`.

### Events (emitted for every mint and every owner action)

`FreeMinted(minter, tokenId)`, `PaidMinted(minter, tokenId, pricePaid)`,
`Withdrawn(to, amount)`, `BaseURISet(baseURI)`, `BaseURIFrozen(baseURI)`,
plus the standard ERC-721 `Transfer` events.

### Metadata

`tokenURI(tokenId)` returns `baseURI + "<tokenId>.json"` (Stage 2 layout:
5,555 metadata JSON files). The base URI is set at deployment and changeable by
the owner until frozen. No deployed contract address is hardcoded anywhere.

### Deliberate design choices

- **No `receive()` / `fallback()`.** Plain BNB transfers to the contract revert,
  so funds can never get stuck by accident. The only way BNB enters is exact
  payment through `paidMint`, and `withdraw()` can always drain the full balance.
- **Events are emitted before the external call** (`_safeMint` / `.call`).
  A revert in the call rolls the whole transaction — log included — back, so
  no false event can ever be recorded. (This is also why one `forge-lint`
  suppression exists in `paidMint`: see §5.)
- **All state is written before any external call** in both mint functions
  (validation → accounting → token-ID reservation → mint loop). `paidMint`
  reserves the whole token-ID range up front (`nextTokenId += qty`) before
  minting, so no state is written after an external call.
- **Custom errors** instead of revert strings (cheaper gas, clearer failures).

## 2. Build & test

```bash
export PATH="$PATH:$HOME/workspace/foundry/bin"
cd repo/contracts
forge build            # exit 0, zero warnings
forge test             # 37 tests, exit 0
forge snapshot         # .gas-snapshot
```

### Results (2026-11-18)

| Suite | Tests | Result |
|---|---|---|
| `test/AurumAgents.t.sol` (unit) | 30 | **30/30 pass** |
| `test/AurumAgentsFork.t.sol` (BSC mainnet fork) | 7 | **7/7 pass** |
| **Total** | **37** | **37/37 pass** |

Unit coverage: deployment constants; free-mint success/second-claim/different
wallets/transfer-does-not-reset-claim/sold-out (all 1,111); paid-mint success,
qty bounds (0 and 11 revert), over/under/no payment reverts, per-wallet cap
(10, then 6+5 reverts, 6+4 passes), paid sold-out (all 4,444); combined cap
(1 free + 10 paid = 11); max supply (5,555, both allocations exhausted);
pause blocks minting / unpause resumes / pause only-owner; withdraw success /
only-owner / empty balance; setBaseURI success / only-owner / freeze locks;
tokenURI of nonexistent token reverts; enumeration (`tokenOfOwnerByIndex`);
plain BNB transfer reverts; reentrancy attacks on free mint, paid mint and
withdraw all fail (attacker contracts in the test file).

### Mainnet-fork tests — LOCAL VERIFICATION ONLY

`test/AurumAgentsFork.t.sol` runs the contract against a local copy of real BSC
mainnet state at **pinned block 134344538** (fetched 2026-11-18). It proves the
contract works against live chain data (chain ID 56, real `block.timestamp`,
real WBNB contract read: `totalSupply() > 0`). **Nothing is broadcast, no BNB
is spent, no transaction ever leaves this machine.** Fork mints are local
simulations for verification only and must never be presented as on-chain
transactions.

**RPC note (2026-11-18):** the official `https://bsc-dataseed.bnbchain.org`
returns `error -32000: missing trie node` for state queries at the pinned block
from this setup (also at block 134340000), and OnFinality
(`https://bnb.api.onfinality.io/public`) reports the historical state
unavailable. The fork tests therefore use **`https://bsc-rpc.publicnode.com`**,
which serves the pinned block correctly. `foundry.toml` lists all three
endpoints; re-check at Stage 9 — a different endpoint may be needed if
PublicNode's availability changes. Fork state is cached under
`~/.foundry/cache/rpc/`, so repeat runs are fast.

## 3. Gas report

Measured 2026-11-18, solc 0.8.38, optimizer on, 200 runs. Full per-test figures
in `.gas-snapshot`; function medians from `forge test --gas-report`.

| Operation | Gas (measured) |
|---|---|
| Deployment | **2,117,460** (bytecode 9,887 bytes) |
| `freeMint()` (first mint for a wallet) | **201,164** (median 186,864 across 2,239 calls) |
| `paidMint(3)` (first purchase) | **435,867** (~145,289 / token) |
| `paidMint(10)` | **1,238,726 median** (~123,873 / token steady-state) |
| `withdraw()` | ~33,659 avg |
| `pause()` / `unpause()` | ~26,412 / ~26,327 |
| `setBaseURI()` | ~28,251 avg |
| `freezeBaseURI()` | ~37,604 avg |

**BNB cost is not quoted here** — it depends on the live BSC gas price at the
moment of the transaction. Formula: `cost (BNB) = gas × gas price (gwei) × 10⁻⁹`.
Illustrative only, at 1 gwei: deployment ≈ 0.00212 BNB; a free mint ≈ 0.00019 BNB;
a 10-NFT paid mint ≈ 0.00124 BNB (+ 0.01 BNB mint price). **Get a live gas quote
at Stage 9 before approving deployment; never present these illustrative figures
as a quote.**

## 4. Deployment script (NOT executed)

`script/Deploy.s.sol` — `forge script` deployment, prepared for Stage 9, **never
run**. It deploys only the contract (mints nothing, transfers nothing) and needs
three env vars at deploy time: `DEPLOYER_PRIVATE_KEY`, `OWNER_ADDRESS`
(multisig recommended), `BASE_URI`. No keys exist on this machine and none were
created. Dry-run (no broadcast) for Stage 9 preparation:

```bash
forge script script/Deploy.s.sol --rpc-url https://bsc-rpc.publicnode.com
```

## 5. Security

### Slither 0.11.6 (installed free via pip into `~/workspace/slither-venv`)

```bash
~/workspace/slither-venv/bin/slither . --exclude-dependencies
# analyzed 24 contracts with 102 detectors
```

**Result: 3 findings, all INFO severity, all reviewed — zero medium/high/critical.**

| Detector | Finding | Verdict |
|---|---|---|
| `pragma` | Different pragma directives across OpenZeppelin files | Expected. Our file pins `0.8.38`; OZ files use their own ranges. No action. |
| `dead-code` | `AurumAgents._increaseBalance` "never used" | **False positive.** It is an override invoked by OZ's ERC721 via virtual dispatch; removing it breaks compilation (the override is required by `ERC721Enumerable`). |
| `low-level-calls` | `withdraw()` uses `.call{value:}` | **Intentional.** `.call` is the recommended ETH-transfer method (no 2,300-gas stipend limit); the return value is checked, the function is `nonReentrant` + `onlyOwner`, and the amount is the full balance. |

Two further detectors fired during development and were **fixed, not waived**:
`costly-loop` and `reentrancy-no-eth` in `paidMint` — resolved by reserving the
token-ID range before the mint loop, so no state is written after any external
call. Re-running Slither after the fix confirms both are gone.

One `forge-lint` suppression remains in `paidMint`:
`// forge-lint: disable-next-line(reentrancy-events)` on the `PaidMinted` emit.
It is a **false positive**: the emit follows the previous loop iteration's
`_safeMint`, but the receiver cannot fabricate logs from this contract, all
state is written before any external call, and `nonReentrant` blocks reentry.
The build is warning-free with the suppression in place.

### Manual security checklist (reviewed 2026-11-18)

| Check | Result |
|---|---|
| Reentrancy | PASS — `nonReentrant` on `freeMint`, `paidMint`, `withdraw`; checks-effects-interactions throughout; live reentrancy-attack tests on all three entry points fail. |
| Integer overflow | PASS — Solidity 0.8.38 checked arithmetic everywhere; the only `unchecked` block was removed in the final loop restructure. `qty * PAID_PRICE` cannot overflow (qty ≤ 10). |
| Access control | PASS — `onlyOwner` on pause/unpause/setBaseURI/freezeBaseURI/withdraw; `transferOwnership` is OZ `Ownable`. No other privileged function exists. |
| Payment validation | PASS — exact-value check `msg.value == qty * PAID_PRICE`; over/under/no payment all revert (tested). No `receive()`/`fallback`, so stray BNB cannot enter. |
| Supply accounting | PASS — separate `freeMinted`/`paidMinted` counters; both allocations and `MAX_SUPPLY` checked on every mint; sold-out tests mint all 1,111 + 4,444 = 5,555 and prove further mints revert. |
| Per-wallet limits | PASS — `hasClaimedFree` (1 free, survives transfers) and `paidMintedBy` (max 10) both tested to the boundary. |
| Pause behaviour | PASS — pause blocks both mint functions, unpause resumes; transfers are not paused (by design — pausing must never lock users out of their NFTs). |
| Metadata | PASS — `tokenURI` reverts for nonexistent tokens; base URI owner-settable until frozen; freeze is one-way. |
| Hidden minting | PASS — no owner mint, no allowlist mint, no airdrop function; the owner cannot create tokens outside the two public mint paths. |
| Denial of service | PASS — no unbounded loops over user-controlled data (`paidMint` loops at most 10 times); no external calls in views. |
| Front-running | Not applicable — minting is first-come-first-served by design; no price or allocation depends on ordering. |
| Upgradeability | None — the contract is not upgradeable and not a proxy. What is deployed is final; verify before deploying. |

**This is not a formal audit.** Slither + the manual checklist + 37 tests are
Stage 3 verification. An external audit is recommended before mainnet
deployment if the owner wants one (Stage 9 decision, owner-funded if paid).

## 6. Mainnet deployment + verification (Stage 9)

**Prerequisites (all open — see §7):** deployer wallet + explicit owner approval
after a live gas quote; owner address (multisig recommended); metadata base URI
(R2 or Pages-static location from Stage 2); Etherscan API key check (B6 below).

### Deploy

```bash
# 1. Dry run first (no broadcast, no spend)
forge script script/Deploy.s.sol --rpc-url https://bsc-rpc.publicnode.com

# 2. After owner approval, with a live gas quote shown to the owner:
forge script script/Deploy.s.sol \
  --rpc-url https://bsc-rpc.publicnode.com \
  --broadcast \
  --verify \
  --verifier etherscan \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

Record the deployed address immediately; it is the only contract address the
frontend, dashboard and prompt center may use. Never hardcode an address before
deployment.

### Verify on BscScan

`forge verify-contract` (Etherscan API V2, one key, `chainid=56`):

```bash
forge verify-contract --chain-id 56 --verifier etherscan \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  <DEPLOYED_ADDRESS> src/AurumAgents.sol:AurumAgents
```

**Open question (Stage 1 blocker B6):** in November 2025 Etherscan reduced the
free API tier's chain coverage, and one report lists BNB Smart Chain among
chains marked paid-only on the free tier. The BLOCKPAY project verified contracts
on BSC **testnet** (chainid 97) via API V2 on 2026-11-09, so V2 verification
works from this setup — but whether a **free** key covers BSC **mainnet**
verification must be re-checked at Stage 9. Fallbacks if the free tier does not
cover it: verify via the BscScan website "Verify and Publish" form (free,
manual), or get owner approval for a paid Etherscan key. **Do not assume
verification will work until tested.**

### Post-deploy checklist (Stage 9)

1. Confirm the deployed bytecode matches the local build (`forge verify-contract`
   or BscScan "exact match").
2. Read the on-chain constants (`MAX_SUPPLY`, `FREE_SUPPLY`, `PAID_SUPPLY`,
   `PAID_PRICE`) and confirm they match §1.
3. Confirm `owner()` is the intended owner/multisig.
4. Confirm `baseURI()` points at the live metadata location; mint a test token
   only if the owner approves the gas (a test mint is a real mainnet transaction).
5. Consider `freezeBaseURI()` once metadata is final — one-way, owner decision.

## 7. Open items for Stage 9

- **B3 — deployer wallet + approval:** no deployer wallet supplied; deployment
  locked until the owner supplies one, sees a live gas quote, and approves.
- **B6 — free Etherscan key coverage of BSC mainnet verification:** unconfirmed;
  test at Stage 9 (see §6).
- **Metadata base URI:** depends on Stage 2 (R2 vs Pages-static) and Blocker B4
  (R2 needs a payment method on file) — the deploy script takes it as an env var.
- **Owner address:** recommend a 2-of-3 multisig (BLOCKPAY precedent); owner decision.
- **Formal audit:** not done; owner decision whether to commission one.
- **Fork RPC:** `bsc-dataseed` currently returns "missing trie node" for fork
  state queries from this setup; fork tests use PublicNode. Re-check endpoints
  at Stage 9.

## 8. Files

```
repo/contracts/
├── foundry.toml            # solc 0.8.38, optimizer 200 runs, BSC RPC endpoints
├── .gas-snapshot           # gas figures (forge snapshot)
├── src/AurumAgents.sol     # the contract
├── test/AurumAgents.t.sol  # 30 unit tests (+ 2 reentrancy-attacker helpers)
├── test/AurumAgentsFork.t.sol  # 7 BSC mainnet-fork tests (pinned block 134344538)
├── script/Deploy.s.sol     # deployment script — PREPARED ONLY, never executed
└── docs/contracts.md       # this file
```

Dependencies (pinned): `lib/forge-std` v1.17.0, `lib/openzeppelin-contracts` v5.6.1.
