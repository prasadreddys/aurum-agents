# AURUM AGENTS — Stage 7 Completion Report

**Date:** 2026-11-18 (evening, IST)
**Scope:** Security checks + local production builds — contract re-check
(Slither + manual review + full test suite), frontend security
(npm audit, secrets grep, rendering/CSP review), clean production
builds (frontend + contract) with local serve verification.
**Status:** COMPLETE. Headline verdict: **READY for Stage 8. Nothing
blocks Stage 8.** For Stage 9 (mainnet deployment) the must-fix list is
small — one small code change (tokenURI link scheme allowlist) plus
decisions/checks that are not code (external audit, multisig owner,
live gas quote, metadata-host CSP entry, npm audit from another
environment, live WalletConnect test). See §4 for the split.

No deployment to any real chain, no BNB spent, nothing broadcast.
No files were edited by this stage except this report — the only
contract/frontend change proposed is the tokenURI allowlist (§4.1),
left for the owner to approve, not silently applied.

## 1. Contract security

Worked in `repo/contracts/`. Contract **unchanged since Stage 3**
(verified against the Stage 3 record; `forge build` clean, gas
snapshot byte-identical).

### 1.1 Forge build + test — NO DRIFT vs Stage 3

Worker run and coordinator's own re-run agree:

- `forge build` — **exit 0**, "Compiler run successful!"
  (Solc 0.8.38, Foundry 1.9.0). Build warning-free.
- `forge test` — **exit 0. Full suite: 37 passed, 0 failed, 0 skipped**
  (30 unit + 7 fork). Coordinator's own run, verbatim:
  `Ran 2 test suites in 4.75s (6.56s CPU time): 37 tests passed,
  0 failed, 0 skipped (37 total tests)`.
- Fork suite: all 7 passed first try against
  `https://bsc-rpc.publicnode.com` at pinned block 134344538 — no
  rate-limiting, no retry needed.
- Reentrancy attack tests pass on all three entry points
  (`test_Reentrancy_FreeMint`, `test_Reentrancy_PaidMint`,
  `test_Reentrancy_Withdraw`).

### 1.2 Slither 0.11.6 — identical to Stage 3

Stage 3 command reproduced verbatim (`slither . --exclude-dependencies`),
by the worker and re-run by the coordinator: **3 findings, all INFO,
identical detectors to Stage 3** — `pragma`, `dead-code`,
`low-level-calls`. Zero medium/high/critical. Slither's exit code 255
is its normal "findings present" exit; the analysis completed:
"3 result(s) found". (One procedural note: the first Slither invocation
failed with `FileNotFoundError: 'forge'` because the venv shell lacked
the Foundry bin on PATH — a harness issue, not a contract issue.)

| # | Severity | Detector | Location | Disposition |
|---|---|---|---|---|
| 1 | INFO | `pragma` | 7 solc version constraints across OZ lib files + `0.8.38` in `src/AurumAgents.sol#2` | **Reviewed-acceptable.** Our file pins 0.8.38; OZ files carry their own ranges. No action. |
| 2 | INFO | `dead-code` | `AurumAgents._increaseBalance` (src/AurumAgents.sol#242-247) "never used" | **False positive — confirmed by experiment.** The worker copied the contracts tree to /tmp, deleted the override, and `forge build` failed with `Error (6480): Derived contract must override function "_increaseBalance". Two or more base classes define function with same name...` (ERC721 + ERC721Enumerable). It is required by Solidity multiple-inheritance resolution and is reached via virtual dispatch. No fix possible or needed. Scratch copy deleted afterwards. |
| 3 | INFO | `low-level-calls` | `AurumAgents.withdraw()` (src/AurumAgents.sol#216): `(ok,) = address(owner()).call{value: amount}("")` | **Reviewed-acceptable (intentional).** `.call` is the recommended transfer method (no 2,300-gas stipend limit); return value checked with `revert WithdrawFailed()`; guarded by `nonReentrant` + `onlyOwner`; amount is the full balance; no state changes after the call. |

Full run without `--exclude-dependencies`
(`slither src/AurumAgents.sol`): 62 results across 10 detectors,
**all INFO, all in OpenZeppelin lib code** except the two above. The
other 7 detectors — `incorrect-exp` (Math.mulDiv `^` is intentional
XOR in Newton's-method inverse), `divide-before-multiply`, `assembly`,
`costly-loop` (OZ ERC721Enumerable burn-path code; Slither's call-stack
trace through `paidMint` is an over-approximation — minting never
calls `_removeTokenFrom*`), `solc-version` (lib pragma ranges; actual
compiler is pinned 0.8.38), `too-many-digits`, `unindexed-event-address`
(OZ Pausable events) — are all library-internal, unactionable from this
contract, and reviewed-acceptable. Notably, `costly-loop` and
`reentrancy-no-eth` in `paidMint`, which Stage 3 fixed, **did not
reappear** in either run — the fixes held.

**No new findings. No contract edits warranted.**

### 1.3 Manual review checklist (full read of src/AurumAgents.sol)

| Item | Verdict | Evidence |
|---|---|---|
| Reentrancy — `paidMint` | **PASS** | `nonReentrant`; all checks then all state writes (`paidMintedBy`, `paidMinted`, `nextTokenId` reserved up front) before the loop's `_safeMint` calls; tested by `test_Reentrancy_PaidMint`. The `forge-lint: disable-next-line(reentrancy-events)` suppression on the `PaidMinted` emit is a documented false positive (emit follows the previous iteration's `_safeMint`; receiver cannot fabricate this contract's logs). |
| Reentrancy — `withdraw` | **PASS** | `nonReentrant` + `onlyOwner`; balance read and event emitted before the `.call`; return checked; no state after the call; tested by `test_Reentrancy_Withdraw`. |
| Reentrancy — `freeMint` | **PASS** | `nonReentrant`; `hasClaimedFree` + `freeMinted` set before `_safeMint`; tested by `test_Reentrancy_FreeMint`. |
| Access control — admin functions | **PASS** | `onlyOwner` on all five: `pause`, `unpause`, `setBaseURI`, `freezeBaseURI`, `withdraw`. `transferOwnership`/`renounceOwnership` are OZ `Ownable` (single-step `transferOwnership`, no accept step — see owner-powers note). No other privileged function exists. |
| Pause behaviour | **PASS** | `whenNotPaused` on `freeMint` and `paidMint` only. Transfers, `tokenURI`, views, and `withdraw` keep working while paused — by design, so pausing never locks users out of their NFTs and the owner can still drain funds. Verified in code; `test_Pause_BlocksMinting` passes. |
| Supply-cap enforcement | **PASS** | Separate `freeMinted`/`paidMinted` counters, never mixed. `freeMint` checks `freeMinted >= FREE_SUPPLY` (1111) and `totalMinted() >= MAX_SUPPLY` (5555). `paidMint` checks `paidMinted + qty > PAID_SUPPLY` (4444) and `totalMinted() + qty > MAX_SUPPLY`. Sold-out tests mint all 1,111 + 4,444 = 5,555 and prove further mints revert. |
| Per-wallet limits | **PASS** | `hasClaimedFree` (1 free; set before mint, survives transfers — `test_FreeMint_TransferDoesNotResetClaim`); `paidMintedBy` lifetime cap 10 (`paidMintedBy[msg.sender] + qty > MAX_PAID_PER_WALLET`); combined 11/wallet tested. |
| Exact-payment handling | **PASS** | `msg.value != qty * PAID_PRICE` reverts (`IncorrectPayment`) — under-, over- and zero payment all revert (tested). No `receive()`/`fallback()` in the contract (grep count 0), so stray BNB cannot enter; `test_NoReceive_PlainTransferReverts` passes. No dust possible: exact-value only, no refunds. `qty * PAID_PRICE` cannot overflow (qty ≤ 10, Solidity 0.8.38 checked arithmetic, no `unchecked` blocks in the contract). |
| baseURI freeze one-wayness | **PASS** | `freezeBaseURI()` sets `baseURIFrozen = true` with no setter to clear it; `setBaseURI` reverts `BaseURIFrozenAlready` once frozen; `freezeBaseURI` itself reverts if already frozen. No code path resets the flag. Tested by `test_FreezeBaseURI_Locks`. |
| Integer overflow (general) | **PASS** | Solidity 0.8.38 checked arithmetic throughout; view subtractions (`remainingFree`, `remainingPaid`, `remainingSupply`, `paidMintRemaining`) are safe because the minuends are capped by the mint checks. |

**Owner powers — exact enumeration (verified in code):**
- **CAN:** pause/unpause minting; set baseURI (until frozen);
  permanently freeze baseURI; withdraw the contract's entire BNB
  balance to the owner address; transfer ownership (single-step,
  immediate — OZ `Ownable`, no 2-step accept); renounce ownership
  (would permanently lock pause/withdraw/admin functions — a footgun,
  but standard OZ behaviour, not a contract bug).
- **CANNOT:** mint any token for free or otherwise (no owner mint, no
  allowlist/airdrop function); change `PAID_PRICE`, `MAX_SUPPLY`,
  `FREE_SUPPLY`, `PAID_SUPPLY`, or `MAX_PAID_PER_WALLET` (all
  `constant`, fixed at deployment); mint outside the two public paths;
  change per-wallet limits; drain funds except via `withdraw` to the
  owner address; unfreeze baseURI; upgrade the contract (not a proxy,
  no upgrade path).

Minor observations (not findings, no action proposed): if the owner
address were ever a contract that rejects BNB, `withdraw()` would
revert (`WithdrawFailed`) and funds would stay locked until the owner
can receive — owner key/address management matters, standard for this
pattern. `renounceOwnership()` is available via OZ Ownable; renouncing
would brick admin functions — worth a one-line note in the Stage 9
runbook (use multisig owner, never renounce).

### 1.4 Gas snapshot — NO DRIFT

Regenerated with `forge snapshot`: **byte-identical to the saved
`.gas-snapshot`** (`diff` clean). `forge test --gas-report`
reproduces the Stage 3 medians exactly:

| Metric | Stage 3 baseline | Stage 7 measured |
|---|---|---|
| Deploy cost | 2,117,460 | **2,117,460** (size 9,887 bytes) |
| `freeMint` | ~201k | max **201,164** (avg 186,599; min 28,586 — first-mint cold storage) |
| `paidMint(10)` | ~1,238,726 | median **1,238,726** (avg 1,214,123; max 1,258,626) |
| `withdraw` | ~33,659 | avg **33,659** (median 34,188; max 37,538) |

Note on the deploy figure: a fresh local anvil deploy with a 33-byte
baseURI (`https://example.invalid/metadata/`) cost **2,162,007** gas
— +44,547 vs the snapshot, fully explained by the baseURI length
crossing Solidity's 31-byte short-string threshold (a 33-byte string
needs a length slot + 2 data slots vs 1 slot for ≤31 bytes), not a
code change. **Stage 9 implication: real deploy gas depends on the
real baseURI length; a production-length baseURI will cost ~2.16M,
not 2.117M.** (The `.gas-snapshot` file records whole-test-function
gas, e.g. `test_FreeMint_Success` 285,661 — not single-call medians,
so the two views are not directly comparable; the identical snapshot
values are what confirm no regression.)

## 2. Frontend security

Worked in `repo/frontend/`. No files edited, nothing deployed, no
secrets printed.

### 2.1 npm audit — BLOCKED, no counts obtainable

`npm audit` (human and `--json`, run twice by the worker and
reproduced by the coordinator) fails identically:

```
npm warn audit 403 Forbidden - POST https://registry.npmjs.org/-/npm/v1/security/audits/quick - policy_denied
npm error audit endpoint returned an error
{ detail: 'POST /-/npm/v1/security/audits/quick not permitted by policy',
  policy: 'zz_managed_internal_spaces_package_registries',
  rule: 'POST /-/npm/v1/security/audits/quick' }
```

Registry **GETs work** (`npm view vite version` → `8.3.8`), so this is
the sandbox egress proxy blocking only the audit POST endpoint — not
a network outage and not an npm outage. **No severity counts exist to
report, and `npm audit fix` was not run.** Fix safety cannot be
assessed without audit data — `npm audit` must be run from an
environment where the audit POST is allowed (see §4.6).

Installed direct-dependency snapshot (from `npm ls --depth=0`, for
manual advisory cross-check): vite 8.3.8, react/react-dom 19.3.1,
wagmi 3.7.11, viem 2.56.8, @wagmi/connectors 8.2.4,
@walletconnect/ethereum-provider 2.26.0, @tanstack/react-query
5.108.0, tailwindcss/@tailwindcss/vite 4.3.3, qrcode 1.5.4,
typescript 7.0.2, oxlint 1.94.0, @vitejs/plugin-react 6.3.0.
Minor note: `npm ls` lists 5 **extraneous** packages not in
`package.json` (`@emnapi/core`, `@emnapi/runtime`,
`@emnapi/wasi-threads`, `@napi-rs/wasm-runtime`,
`@tybys/wasm-util`, `tslib`) — stale transitive leftovers, not a
vulnerability signal, but untracked in the manifest.

### 2.2 Secrets grep — CLEAN

Searched repo source (`src/`, `scripts/`, config files,
`public/_headers`, `public/favicon.svg`,
`public/gallery-index.json`) and the built bundle (`dist/assets/` +
`dist/index.html`). One process note: recursive grep over `public/`
hung twice because `public/artwork/` + `public/metadata/` hold 5,555
files each — greps were re-run scoped to the small files only.
Coordinator spot-checked the dist bundle independently with the same
result.

| Pattern | Result / verdict |
|---|---|
| Reown ID `3fad3d85…` | **Only in `frontend/.env` (1 occurrence) and `dist/assets/index-DPa4_Gun.js`** — expected: public by design, inlined from `.env` at build. Never hardcoded in source; `src/config/env.ts` validates it as 32 hex chars and treats anything else as "not configured". |
| `aurum-pages-preview` (token name) | **Zero matches everywhere, including the dist bundle.** |
| Cloudflare tokens (`cfut_`, `cfat_`, `CLOUDFLARE_API_TOKEN/KEY`, `CF_API_TOKEN`) | **Zero matches.** |
| `Bearer <token>` | **Zero matches.** |
| AWS keys (`AKIA…`, `aws_secret_access_key`) | **Zero matches.** |
| `0x` + 64 hex (source/scripts/config) | **2 hits, both benign:** `scripts/anvil-integration-test.mjs:51,54` — the well-known public anvil test keys (accounts 1 & 2), explicitly commented as public test keys holding fake anvil ETH only. `OWNER_PRIVATE_KEY` is read from an env var only (line 31), never hardcoded or printed. |
| `0x` + 64 hex (dist bundle) | Matches are **substrings of longer hex literals in viem's bundled code** (EVM init bytecode in `_esm`/`ccip` chunks; a `BigInt(0x0051953e…)` library constant in `core` chunk) — not keys. |
| Seed phrase / mnemonic / `privateKey` literals | **Zero matches** for mnemonic/seed-phrase. `privateKey` appears only as viem's `privateKeyToAccount` import and the env-var plumbing in the anvil script. Generic secret-word grep (`api_key`, `password`, `secret`, `access_token`…) returned nothing beyond comments. |

- `frontend/.env`: `.gitignore` correctly lists `.env` and `.env.*`
  with `!.env.example`. **Caveat:** the repo directory is **not a git
  repository** (`git rev-parse` → `fatal: not a git repository`), so
  git tracking/ignore status could not be verified via git — the rule
  is present, the enforcement is unconfirmable in this checkout.
- `VITE_CONTRACT_ADDRESS` confirmed empty in `.env`
  (`^VITE_CONTRACT_ADDRESS=$`).
- `dist/` is present and current; `dist/_headers` is **identical** to
  `public/_headers` (coordinator-verified with `diff`).

### 2.3 Dangerous rendering — CLEAN, with one hardening note

- `dangerouslySetInnerHTML`: **0 matches** in `src/`, `scripts/`,
  public small files, `index.html`, `vite.config.ts`.
  `innerHTML` / `outerHTML` / `document.write` /
  `insertAdjacentHTML`: **0**. `eval(` / `new Function` / `__html`:
  **0**. `window.open` / `location.assign`: **0**.
  (Coordinator re-confirmed the `dangerouslySetInnerHTML` /
  `innerHTML` count: none.)
- All untrusted data reaches the DOM only as **React JSX text
  interpolation (auto-escaped)**: wallet address in
  `WalletButton.tsx` (`{address}` as text), truncated addresses in
  `ActivityFeed.tsx` (`slice(0,6)…slice(-4)`), truncated tokenURI text
  in `MyNFTs.tsx`, local gallery traits in `Gallery.tsx` /
  `MyNFTs.tsx`. On-chain metadata `name`/`image`/`description` are
  parsed with `typeof` checks in `useOwnedTokens.ts` and are **not
  rendered at all** in MyNFTs (only the tokenURI string + local traits
  are shown).
- External links: **13× `target="_blank"`, all 13 carry a `rel`** —
  12× `rel="noreferrer"`, 1× `rel="noopener noreferrer"`
  (`StatsPanel.tsx:48`). `noreferrer` implies `noopener` in modern
  browsers, so no tabnabbing exposure; the inconsistency is cosmetic
  only.
- BscScan URL builders (`src/config/contract.ts:22-28`) interpolate
  hash/address/tokenId into fixed `https://bscscan.com/…` templates;
  hashes come from viem-typed event logs, tokenId is `bigint` /
  `number`, contract address is validated as `0x`+40 hex in `env.ts`.
  No user-controlled scheme.
- `fetch()` calls in `src/`: only `/gallery-index.json`
  (same-origin) and `fetch(tokenURI)` in `useOwnedTokens.ts:88`
  (8 s timeout, any failure → `undefined`, never throws). Images are
  same-origin `/artwork/{numeric-id}.webp`; the WalletModal QR is a
  `data:` URL from the `qrcode` lib.
- **Hardening note (not an active vuln — path unreachable today):**
  `MyNFTs.tsx:149` renders `href={token.tokenURI}` where tokenURI is
  read on-chain. React does not sanitise `href` schemes, so a
  `javascript:` tokenURI would execute on click. Currently unreachable
  (`CONTRACT_DEPLOYED` is false; the project's own contract will set
  baseURI under owner control in Stage 9). See §4.1 — an
  `http(s):`/`ipfs:` scheme allowlist on tokenURI links should land
  before Stage 9 goes live.

### 2.4 CSP review — `public/_headers`, quoted verbatim

```
Content-Security-Policy: default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://bsc-rpc.publicnode.com https://bsc-dataseed.bnbchain.org wss://relay.walletconnect.com https://relay.walletconnect.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```

Other headers in the same file: `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy: camera=(), microphone=(), geolocation=()`,
`Strict-Transport-Security: max-age=31536000; includeSubDomains`.
The file also carries the Stage 4 comment warning that `connect-src`
must list every off-origin host.

Verification:
- ✅ `connect-src` still lists **both** RPC hosts
  (`https://bsc-rpc.publicnode.com`,
  `https://bsc-dataseed.bnbchain.org`) **and** the WalletConnect relay
  (`wss://relay.walletconnect.com`,
  `https://relay.walletconnect.com`) — matches `src/config/env.ts`
  defaults and Stages 5–6 needs.
- ✅ `script-src 'self'` — no external scripts; `index.html` loads
  only the local `/src/main.tsx` module. No external script hosts to
  add.
- ✅ `img-src 'self' data:` covers same-origin `/artwork/` and the QR
  `data:` URL. `font-src`/`style-src` match the Google Fonts
  stylesheet + preconnects in `index.html`. `frame-ancestors 'none'`
  + `X-Frame-Options: DENY` are redundant but harmless;
  `default-src 'self'` covers `object-src`/`worker-src` (not set
  explicitly).
- Open (not a fix — Stage 8): `useOwnedTokens.ts:88` fetches the
  on-chain tokenURI, which will be off-origin once the base URI host
  is chosen in Stage 8 — that host is **not** in `connect-src` today.
  Add it in Stage 8 (and to `img-src` too if metadata images are ever
  rendered from it; they are not today).
- Open (unconfirmed): the WalletConnect SDK may call
  `verify.walletconnect.com`, `explorer-api.walletconnect.com`, or
  `api.web3modal.org` — no failure observed in tests so far (Stage 4
  relay check passed; the 18 Nov live test used MetaMask), but a live
  WalletConnect end-to-end test should confirm no CSP block; add
  narrowly only if one appears.
- `style-src 'unsafe-inline'` is present (likely Tailwind v4/Vite
  inline styles); acceptable as-is, but whether the build still needs
  it could be re-checked — do not remove without testing.

## 3. Production builds

### 3.1 Frontend clean production build — PASS

- `rm -rf dist && npm run build` in `repo/frontend/`: **exit 0**.
  Vite build in **18.85s** (~50s wall including `tsc -b`, which
  `npm run build` runs first).
- Largest output chunks: `index-DPa4_Gun.js` 426.01 kB (gzip 124.89
  kB), `core-AcPaYbS4.js` 401.23 kB (gzip 116.78 kB),
  `dist-B0pVbXu4.js` 322.72 kB (gzip 92.72 kB),
  `w3m-modal-DuQuM2aR.js` 164.96 kB (gzip 34.56 kB). Total `dist/` is
  104 MB (5,555 artwork files + 5,555 metadata files dominate).
- `npx tsc --noEmit`: **exit 0**, no errors.
- `npm run lint` (oxlint): **exit 0, 0 errors, 1 warning** — the same
  pre-existing `WalletModal.tsx:56` `react(set-state-in-effect)`
  warning (`setWcUri(null)` / `setQrDataUrl(null)` inside `useEffect`).
  **No new warnings.** (Coordinator re-ran lint: same 1 warning,
  0 errors.)

### 3.2 vite preview serve check — PASS (with one expected caveat)

- Served `dist/` via `npx vite preview --port 4173` (bound `[::1]:4173`
  only — first curl to `127.0.0.1` returned 000 for that reason;
  `localhost` worked). All checks **HTTP 200**: `/` (index),
  `/gallery-index.json`, `/artwork/1.webp`, `/_headers`.
- **CSP header: NOT present in vite preview responses.** This is
  expected — `vite preview` does not apply `_headers` (that is a
  Cloudflare Pages feature). The `_headers` file itself IS in `dist/`
  and contains the full CSP (see §2.4). It will take effect on Pages
  (Stage 8), not in local preview. Server stopped cleanly (killed by
  PID in a separate exec; port 4173 confirmed free afterwards).

### 3.3 Contract production build + gas — PASS

- `forge build` (solc 0.8.38, Foundry 1.9.0): **exit 0**, "Compiler
  run successful!", 45 files. (Coordinator re-ran: exit 0.)
- Fresh `forge snapshot`: **37/37 tests passed, 0 failed**, exit 0.
  The regenerated `.gas-snapshot` matches the Stage 3 file exactly on
  every spot-checked function: `test_FreeMint_Success` 285,661;
  `test_PaidMint_Success` 535,289; `test_Withdraw_Success` 1,035,816;
  fork `test_Fork_FreeMint` 229,275; `test_Fork_PaidMint` 1,282,612 —
  contract code unchanged since Stage 3. See §1.4 for the gas medians
  and the baseURI-length deploy note.

### 3.4 Bundle hygiene — PASS

- (a) Anvil/test addresses (`0x5fbd…`, `0xf39f…`, `0x7099…`): **no
  hits** in `dist/assets/` or `index.html` (coordinator re-confirmed
  for the deployed anvil contract address).
- (b) `localhost` / `127.0.0.1` / `31337`: **`31337` — zero hits
  anywhere.** `localhost`/`127.0.0.1` appear ONLY in three
  Reown/WalletConnect vendor chunks (`ApiController`, `core`,
  `index.es`) as the SDK's own `DEFAULT_ALLOWED_ANCESTORS` list and
  localhost-detection logic
  (`if(i.hostname==='localhost'||i.hostname==='127.0.0.1')return!0`,
  `wss?://localhost(:d{2,5})?`) — **not** in our app bundle
  `index-DPa4_Gun.js` (zero hits). No app code points at a local node.
- (c) Cloudflare token pattern (`cfut_` / `CLOUDFLARE_API_TOKEN`):
  **no hits** (grep exit 1; coordinator re-confirmed).
- Reown project ID `3fad3d85d10759cb9e8e9f7e3d0be5d7`: **present** in
  `assets/index-DPa4_Gun.js` (public by design).
- `dist/` top level: `_headers`, `artwork/` (5,555 files), `assets/`,
  `favicon.svg`, `gallery-index.json`, `index.html`, `metadata/`.

### 3.5 Anvil integration test (extra signal) — 93/93 PASS

Fresh anvil (chain 31337) + fresh local deploy, then
`node scripts/anvil-integration-test.mjs`: **exit 0, 93 PASS, 0 FAIL,
"ALL CHECKS PASSED"** — same count as the Stage 6 parent verification.
Two process notes: (i) the first run scored 91/93 — both failures were
the worker's own error, deploying with
`BASE_URI="https://aurum.test/metadata/"` while the test hardcodes
`https://example.invalid/metadata/` (checks at lines 106 and 271);
redeploying with the expected URI fixed both. (ii) The test is **not
idempotent** — a second run against the same deployed contract fails
the "before" checks (totalMinted 4, not 0) because state persists; it
needs a fresh deploy each run. Anvil stopped cleanly afterwards (port
8545 confirmed free).

## 4. Open issues for Stage 9 — must-fix vs acceptable

### 4.1 Must fix before mainnet deployment (code)

1. **tokenURI link scheme allowlist** (`MyNFTs.tsx:149`). `href={token.tokenURI}`
   renders an on-chain string as a link target; React does not
   sanitise `href` schemes, so a `javascript:` tokenURI would execute
   on click. Unreachable today (no contract deployed; the project's
   own contract will set baseURI under owner control). Small fix:
   allow only `http:` / `https:` (and `ipfs:` if ever used) schemes,
   else render the URI as plain text. **This is the only code change
   Stage 7 proposes.**

### 4.2 Must address before / at Stage 9 (decisions & checks, not code)

2. **CSP: add the metadata base-URI host in Stage 8.** `connect-src`
   (and `img-src` if metadata images are ever rendered from it) must
   gain the base-URI host once it is chosen, or `fetch(tokenURI)` will
   be blocked in the browser after deployment.
3. **Formal external audit: NOT done.** Slither + manual review +
   tests is not a formal audit (per `docs/contracts.md` §5). Whether
   to commission one is a Stage 9 owner decision.
4. **Owner should be a 2-of-3 multisig** (standing recommendation
   from Stage 3). The owner is single-step `transferOwnership` and can
   `renounceOwnership()` — renouncing would permanently brick pause /
   withdraw / admin functions. Add to the Stage 9 runbook: use a
   multisig owner, never renounce.
5. **Live gas quote at Stage 9.** Deploy gas is ~2.12M with a short
   baseURI and ~2.16M with a production-length (33-byte) baseURI;
   quote the real cost with the real baseURI and live gas price before
   the owner approves.
6. **npm audit must run from another environment.** The sandbox egress
   proxy blocks the audit POST (`policy_denied`); no dependency
   vulnerability data exists for this stage. Run `npm audit` (and
   `npm audit fix` assessment) outside this VM before mainnet.
7. **Live WalletConnect end-to-end test.** Auxiliary WalletConnect
   hosts (`verify.walletconnect.com`,
   `explorer-api.walletconnect.com`, `api.web3modal.org`) are
   unconfirmed against the CSP; a real WalletConnect connection in the
   user's browser should confirm no CSP block before mainnet.
8. **Free-tier `eth_getLogs` flakiness (Stage 6).** PublicNode
   rate-limits log queries intermittently; dataseed rejects them. The
   activity feed degrades honestly, but on mainnet history will
   sometimes show "unavailable". A dedicated/paid RPC is a Stage 8/9
   decision, not a code fix.

### 4.3 Acceptable / carried (no action)

- 3 INFO Slither findings, all reviewed (§1.2) — pragma ranges,
  dead-code false positive (proven by experiment), intentional
  low-level `.call` in `withdraw`.
- `style-src 'unsafe-inline'` in the CSP (Tailwind v4 / Vite inline
  styles) — acceptable as-is.
- 5 extraneous npm packages (`@emnapi/*`, `@napi-rs/wasm-runtime`,
  `@tybys/wasm-util`, `tslib`) — stale transitive leftovers, not a
  vulnerability signal.
- `rel="noreferrer"` vs `rel="noopener noreferrer"` inconsistency
  across 13 external links — cosmetic; `noreferrer` implies `noopener`.
- `localhost` / `127.0.0.1` strings in Reown/WalletConnect vendor
  chunks only — SDK-internal, not app code.
- `withdraw()` to an owner address that rejects BNB would revert and
  leave funds locked until the owner can receive — owner
  key/address management, standard for this pattern.
- No git repo at the checkout path — `.env` ignore rules are present
  in `.gitignore` but enforcement is unconfirmable; consider
  initialising git and confirming `.env` stays untracked before Stage 8.
- No real-browser test of live events/history or mint/admin clicks
  until a contract exists on-chain (Stage 9) — unchanged from Stages
  5–6.

## What Stage 7 did NOT do

- No deployment to any real chain, no BNB spent, no accounts created.
- No fake data: every figure above is a measured tool output.
- No contract or frontend code was edited; the one proposed code
  change (§4.1) is recorded, not applied.
- No network switching, no auto-signing; the audit is read-only.
- The anvil integration test ran only against local anvil (chain
  31337); the deploy script was never run against a real network.

## Follow-up (19 Nov 2026, ~00:15 IST) — §4.1 fix applied + verified by parent

The one proposed code change was applied (not left pending):
`MyNFTs.tsx` now gates the "Metadata ↗" link on an `isSafeTokenURI`
allowlist (`https://`, `http://`, `ipfs://` only); any other scheme
renders as plain text "Metadata (untrusted link)" with the truncated
URI still shown as text below. Parent-verified: `npm run build` exit 0,
lint 0 errors / 1 pre-existing warning, and the built bundle contains
the new "untrusted link" text and the `ipfs://` check. Preview
redeployed with the fix. The §4.2 decision/check items (external audit,
multisig owner, live gas quote, metadata-host CSP entry, npm audit from
another environment, live WalletConnect test, free-tier log flakiness)
remain open for Stage 8/9.
