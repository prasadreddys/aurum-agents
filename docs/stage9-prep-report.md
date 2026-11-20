# AURUM AGENTS — Stage 9 Prep Report

**Date:** 19 Nov 2026 ~09:58 IST. **Status:** PREP COMPLETE — everything
that can be done without the deployer wallet, owner addresses, or the
owner's audit decision is done. **Nothing is deployed. Nothing is signed.
No BNB spent.** Mainnet deployment stays LOCKED until the owner approves
it after reading this report.

## 1. Live gas quote (measured, not estimated)

Measured 19 Nov 2026 ~09:58 IST from two independent RPCs, both agreeing:

| Source | eth_gasPrice | eth_chainId |
|---|---|---|
| PublicNode `bsc-rpc.publicnode.com` | `0x2faf080` = 50,000,000 wei = **0.05 gwei** | rate-limited on this call (-32005) |
| dataseed `bsc-dataseed.bnbchain.org` | `0x2faf080` = **0.05 gwei** | `0x38` = **56 (BSC mainnet)** |

BNB price at the same time (CoinGecko): **$582.67**.

Deploy cost (Stage 3 gas measurements: 2,117,460 gas with a short
baseURI; ~2,162,007 gas with the production-length baseURI
`https://aurumagents.pages.dev/metadata/`, +44,547 for the 33-byte
baseURI):

| Deploy | Gas | Cost (BNB) | Cost (USD) |
|---|---|---|---|
| Short baseURI | 2,117,460 | 0.000106 | $0.0617 |
| Production baseURI | 2,162,007 | 0.000108 | $0.0630 |

0.05 gwei is BSC's gas-price floor, so this quote is the cheapest the
deploy can be; it rises only if the network is congested at deploy
time. **Recommendation: the deployer wallet should hold at least
0.002 BNB (~$1.17)** — deploy (~$0.06) plus a comfortable buffer for
the owner setup transactions (setBaseURI, etc.) and any retry. The
exact cost will be re-quoted live at deploy time and shown to the
owner before broadcast.

## 2. B6 — RESOLVED (research): free Etherscan API key covers BSC verification

B6 asked whether a free Etherscan API key covers BSC mainnet contract
verification. Answer: **yes**, via the Etherscan API V2 unified
endpoint — confirmed by three agreeing sources (Etherscan V2 docs via
Nethereum, the Chainscan V2 skill reference, and a deployed BSC
project's verify runbook):

- One free Etherscan.io API key works across all chains through
  `https://api.etherscan.io/v2/api`, with `chainid=56` for BSC mainnet.
- Free tier: 5 calls/second. The contract endpoints
  (`verifysourcecode`, `checkverifystatus`, `getabi`,
  `getsourcecode`) are all available on the free tier for BSC 56.
- Old chain-specific keys (BscScan, PolygonScan) do **not** work on
  V2 — the key must be an Etherscan.io key.
- The legacy V1 endpoint (`api.bscscan.com/api`) was deprecated;
  V2 is the only API path.

**What remains:** the owner creates one free key at
https://etherscan.io/myapikey (free signup, ~2 minutes) and supplies
it at deploy time as `ETHERSCAN_API_KEY` (never in chat, never in a
file — same handling as the Cloudflare token). Final proof is at
deploy time: `forge verify-contract` must return success on the real
contract. Fallback if Etherscan verification ever fails: **Sourcify**
(free, no key needed) — `forge verify-contract ... --verifier
sourcify` — plus the BscScan web form.

Tooling check: forge 1.9.0 on this VM builds the contract clean
(Solc 0.8.38, 45 files, exit 0) and `forge verify-contract` supports
`--verifier etherscan` + `--etherscan-api-key` + `--chain 56`.

## 3. Metadata CSP — CLOSED, no change needed

The Stage 7 open item ("metadata-host CSP entry") is closed by
evidence already in the runbook (§6) and re-confirmed here:
the contract baseURI will be `https://aurumagents.pages.dev/metadata/`
— the same origin that serves the site — so `fetch(tokenURI)` is
covered by `connect-src 'self'` in `frontend/public/_headers`.
A CSP entry becomes necessary only if metadata/artwork ever move to
a different host (R2, IPFS gateway, another CDN). No custom domain is
planned (B2 closed), so there is no such case.

## 4. npm audit — STILL BLOCKED on this VM (must run elsewhere)

Re-attempted 19 Nov ~09:58 IST in `repo/frontend/`:
`npm audit` returns 403 `policy_denied` on the audit POST
(`POST https://registry.npmjs.org/-/npm/v1/security/audits/quick not
permitted by policy`). Same block as Stage 7. **It must be run from
another environment** (the owner's machine, or any machine without
this sandbox's egress policy) before mainnet. It is the one security
check still outstanding alongside the audit decision (§7).

## 5. WalletConnect auxiliary hosts — live test still needed

`verify.walletconnect.com`, `explorer-api.walletconnect.com`,
`api.web3modal.org` remain unconfirmed against the CSP (runbook §7).
The relay itself was proven to accept the project ID (Stage 4), but
a full end-to-end WalletConnect pairing has never been run. **Test
plan (needs the owner's browser + a WalletConnect-capable wallet,
e.g. Binance Web3 Wallet or MetaMask mobile):** open
https://aurumagents.pages.dev, connect via WalletConnect, confirm
the pairing completes with no CSP-blocked request in the console.
If a host is blocked, add it narrowly to `connect-src` and redeploy
the site first — this test must pass before the contract goes live,
because users who can only connect via WalletConnect would otherwise
be locked out of minting.

## 6. eth_getLogs on free RPC — accepted limitation

Free-tier `eth_getLogs` is flaky on BSC public RPC (Stage 6:
PublicNode rate-limits, dataseed rejects). The activity feed already
degrades honestly ("Event history unavailable from this RPC"). A
dedicated/paid RPC would fix it but is out of the $0 budget.
**Accepted as-is** unless the owner decides otherwise — no code
change, no cost.

## 7. Owner setup — recommendation (needs the owner's decision)

The contract owner can pause/unpause, set/freeze baseURI, withdraw,
and transfer/renounce ownership — it can never mint, change
price/caps, unfreeze baseURI, or upgrade. Losing the owner key, or
renouncing ownership, bricks admin forever.

**Recommended: a 2-of-3 Safe multisig on BSC mainnet**
(app.safe.global supports BSC 56; free to create, only gas to use).
Needs three signer addresses from the owner — ideally three
different wallets/devices, not three addresses in one wallet.
The multisig address becomes `OWNER_ADDRESS` at deploy time.

Alternative: a single owner address (simpler, but one lost key =
admin gone forever). Not recommended.

## 8. External audit — the honest options under a $0 budget

A formal external audit costs real money (typically thousands of
dollars) and is out of this project's $0 budget. The options:

1. **Proceed without a formal audit** (owner accepts the risk).
   Mitigations already in place: 37/37 forge tests (30 unit + 7
   fork vs BSC mainnet), Slither clean except 3 reviewed INFO
   findings, manual review checklist all PASS, no upgradeability,
   no owner mint, exact-payment checks, reentrancy guard, pausable.
2. **Free community review** — publish the contract and invite
   public review (slow, uncertain, no guarantee anyone looks).
3. **Delay mainnet until an audit budget exists** — safest, but
   the launch waits indefinitely on funding.

There is no free formal audit. The owner picks one of the three.

## 9. Deploy command set (for Stage 9, AFTER approval)

**Deploy method changed 19 Nov ~09:50 IST:** the owner deploys from
their own wallet in the browser (key never leaves their wallet), so
the deploy runs via **Remix IDE + MetaMask**, not via forge on this
VM. Full steps: `repo/docs/remix-deploy-guide.md`. The forge script
below is kept as the reference / dry-run path only.

Remix package (proven 19 Nov): `repo/contracts/flattened/
AurumAgents.flattened.sol` (forge flatten, OZ v5.6.1 inlined) compiles
standalone to **byte-identical** creation bytecode (9,759 bytes) to
the audited forge build (solc 0.8.38, optimizer on, 200 runs).
Remix settings: compiler 0.8.38, optimizer enabled, 200 runs.
Constructor args: `"<OWNER_ADDRESS>",
"https://aurumagents.pages.dev/metadata/"`. Expected gas ~2.16M,
~0.000108 BNB at 0.05 gwei — re-quote live at deploy time, and the
owner reads the MetaMask confirmation before signing.

From `repo/contracts/`, with the env vars supplied at deploy time
(never committed, never printed) — reference/dry-run only:

```sh
# 1. Dry run first (no broadcast) — proves the script, the owner
#    address, and the baseURI are all valid:
forge script script/Deploy.s.sol \
  --rpc-url https://bsc-dataseed.bnbchain.org
# 2. Live gas quote immediately before broadcast (re-quote; show it):
#    eth_gasPrice via PublicNode + dataseed, BNB price via CoinGecko.
# 3. Broadcast + verify (only after the owner approves the quote):
DEPLOYER_PRIVATE_KEY="$(cat /tmp/deployer-key)" \
OWNER_ADDRESS="<multisig-or-owner>" \
BASE_URI="https://aurumagents.pages.dev/metadata/" \
forge script script/Deploy.s.sol \
  --rpc-url https://bsc-dataseed.bnbchain.org --broadcast \
  --verify --verifier etherscan \
  --etherscan-api-key "$(cat /tmp/etherscan-key)"
# 4. Post-deploy: record the contract address, tx hash, BscScan link,
#    and verification status in this report and GOAL.md; set
#    VITE_CONTRACT_ADDRESS in frontend/.env; rebuild; redeploy the
#    site (preview first, then production); live-verify the mint flow.
```

The deploy script mints NOTHING and transfers NOTHING — it spends
BNB only on the deployment gas itself (§1).

## 10. Decisions needed from the owner (nothing deploys without these)

1. **Deployer wallet** — CHANGED 19 Nov ~10:12 IST. A fresh dedicated
   deployer wallet was generated first (address
   `0x03766d6243769ac83774b6b0D6E2AE546a031000`), but the owner then
   chose to use their own wallet as the deployer instead. The fresh
   key was never funded or used; its file was renamed to
   `repo/contracts/.env.mainnet-unused-2026-11-19` (mode 600,
   gitignored) so no deploy step can pick it up by accident.
   **Still needed: the owner's wallet address** (public) so the
   balance (≥0.002 BNB) can be verified on-chain. Signing stays with
   the owner: the key never leaves their wallet, and the deploy
   transaction will be signed in their browser when the time comes.
2. **Owner setup** — 2-of-3 Safe multisig (recommended; needs three
   signer addresses) or a single owner address.
3. **External audit** — proceed without one, seek free community
   review, or delay mainnet until there is an audit budget (§8).
4. **Free Etherscan API key** — create at etherscan.io/myapikey
   (~2 min) and supply at deploy time.
5. **WalletConnect live test** — a few minutes in the owner's
   browser with a WalletConnect-capable wallet (§5), before the
   contract goes live.
6. **npm audit elsewhere** — run `npm audit` in `repo/frontend/`
   from a machine without this sandbox's egress block (§4), and
   share the result.

## 11. Deployment record — DEPLOYED 19 Nov 2026 ~10:24 IST (verified on-chain)

- **Contract:** `0x16dE59897fDeE7F34377C2302dC4e9FDb12168C2`
  (BscScan: https://bscscan.com/address/0x16dE59897fDeE7F34377C2302dC4e9FDb12168C2)
- **Tx:** `0x6b8592d90252cba6f15bfae6dc8759f6869fad7bae24d6cbd6b9b5798de76da4`,
  block 134442754, status 1 (success), gas used 2,162,079 (72 over
  the 2,162,007 estimate), fee 0.00010810395 BNB at 0.05 gwei.
- **Deployer/owner:** `0x86e10a0763A2BA16Fb0B34CD6B3BbD5726295c2E`
  (owner() verified on-chain). Deployer balance after deploy:
  0.00027249605 BNB.
- **Constructor args:** owner = deployer wallet,
  baseURI = `https://aurumagents.pages.dev/metadata/` (verified
  on-chain, 39 chars). Deployed via Remix in the owner's browser
  (flattened file, solc 0.8.38, optimizer on, 200 runs — see the
  Remix guide). A fresh Remix window was needed: the first window
  froze and was closed, then reopened. Remix's pre-deploy check
  flagged OpenZeppelin Math.mulDiv (library code, not our logic) —
  "Deploy anyway" was the right call, verified by reading L2456.
- **On-chain state verified independently via eth_call (cast):**
  MAX_SUPPLY 5555, FREE_SUPPLY 1111, PAID_SUPPLY 4444,
  PAID_PRICE 0.001 BNB, baseURIFrozen false, paused false,
  freeMinted 3, paidMinted 0, totalMinted 3, nextTokenId 4.
- **NOTE — 3 free mints already taken:** within minutes of
  deployment, three unrelated wallets free-minted tokens 1–3
  (seen on the BscScan contract page; freeMinted = 3 confirms it).
  Almost certainly automated mint-snipers watching the chain for
  new free mints. 1,108 of 1,111 free remain. Nothing was minted by
  us; no function was called after deployment except the deploy
  itself. No verification done yet (needs the Etherscan key, item 4).
- **Still open after deploy:** BscScan source verification (item 4),
  WalletConnect live test (item 5), npm audit elsewhere (item 6),
  ownership transfer to a multisig (deferred decision), and wiring
  the site to the live contract (set VITE_CONTRACT_ADDRESS, rebuild,
  redeploy preview + production, live-verify the mint flow).

## 12. Site wiring — LIVE 19 Nov 2026 ~10:39 IST (parent-verified)
- `frontend/.env`: VITE_CONTRACT_ADDRESS=0x16dE59897fDeE7F34377C2302dC4e9FDb12168C2
  (was empty). Rebuild exit 0, new bundle index-DXNWKSsr.js with the
  address inlined; dist 5,555 artwork + 5,555 metadata.
- Preview deploy aca90f14-d88b-4b9d-9f66-99812a7afb4b (11,113 uploaded /
  76 present, 359.36 MiB) — live-verified: index 200, bundle with
  address, gallery-index 5,555, artwork #1/#5555 SHA-256 identical
  to local v3, metadata image substituted to the preview domain.
- Production deploy de2558eb-4d29-4b95-bada-cba07100216e (11,189
  uploaded / 0 present, 362.18 MiB) — live-verified identically at
  https://aurumagents.pages.dev (index 200, bundle index-DXNWKSsr.js,
  contract address in the served bundle, gallery 5,555, art SHA-256
  match, metadata substituted to the production domain, all 200s).
- The "aurum-pages-deploy" token from this morning was still valid
  and was reused for both deploys; the temp file was deleted after
  use. The token VALUE is recorded nowhere.
- NOTE — free mints keep coming: freeMinted was 3 at deploy
  (~10:24 IST) and 11 by ~10:39 IST (nextTokenId 12, paidMinted 0).
  8 more unrelated wallets free-minted in ~15 minutes. 1,100 of
  1,111 free remain. The owner can pause the contract to stop this;
  pausing is an owner decision, not taken here.

## 13. Pause — PAUSED 19 Nov 2026 ~10:52 IST (parent-verified on-chain)
- Pause tx 0x6b2b83b71833b2106a5cce4eb4ef6d4a8e139ab91b61de9d1409f7d61c131232,
  block 134446164, status success, gas 27,836, from the owner wallet,
  Paused event emitted. Called via Remix (At Address) in the owner's
  browser; the owner signed in MetaMask. paused() read false before,
  true after — verified independently via eth_call.
- One more free mint slipped in before the pause landed: totalMinted
  11 -> 12 (freeMinted 12, paidMinted 0, nextTokenId 13). 1,099 of
  1,111 free remain. Minting (free + paid) is now frozen; transfers
  of already-minted tokens are NOT affected (contract uses plain
  Pausable, not ERC721Pausable — only freeMint/paidMint carry
  whenNotPaused). Unpause is the owner's one-transaction call
  whenever they are ready.

## 14. BscScan verification — VERIFIED 19 Nov 2026 ~11:06 IST
- Free Etherscan key: the BITCOINGET account was already at its
  3-key free-plan limit (AGENTRA, TITAN NEXUS AI, BaseDraw). The
  user chose to delete "TITAN NEXUS AI" (added 2026-02-28); the
  browser task deleted exactly that key and created one new free
  key named "AURUM AGENTS". AGENTRA and BaseDraw untouched. The key
  VALUE is recorded nowhere; it was used transiently for the
  verification and the temp file deleted after use.
- Verification: `forge verify-contract` (src/AurumAgents.sol,
  solc 0.8.38, optimizer 200 runs, constructor args owner +
  baseURI) via the Etherscan V2 endpoint (chainid=56). Submission
  GUID jx8clmujx66nsqdqdkv6t73k7casrpdi2bwwzftkr7gu4ujk5k.
  checkverifystatus: "Pass - Verified". getsourcecode confirms:
  SourceCode 184,699 chars, ContractName AurumAgents, compiler
  v0.8.38+commit.1835d247, OptimizationUsed 1, Runs 200.
  https://bscscan.com/address/0x16dE59897fDeE7F34377C2302dC4e9FDb12168C2
  now shows verified source.

## 15. WalletConnect live test — FAILED 19 Nov 2026 ~11:12 IST (browser task)
- The live site reads the contract fine (TOTAL MINTED 12, FREE 12/1,111,
  FREE REMAINING 1,099, PAID 0, "Minting is paused", Paused event
  10:49:34, token #12 mint 10:45:27). Modal order exact (Binance Web3
  Wallet first / NOT DETECTED + disabled, MetaMask second, WalletConnect
  third). The test wallet auto-reconnected on load (0xa7C335E9...,
  0.0000 BNB) and was disconnected by the task to reach the flow.
- WalletConnect FAILED: clicked twice, button went "WAITING…" both
  times, no QR ever rendered (modal shows only the "Scan the code…"
  text, no QR image/canvas). In-page error both times: "Connection
  failed: Failed to publish custom payload, please try again." The
  WalletModal renders its QR only from the provider's display_uri
  event, which fires after the session proposal publishes — the
  publish never succeeded, so no URI and no QR. No mint/sign/tx.
  No console/network log was obtainable in that browser session, so
  the exact blocked host could not be quoted from the page.
- PRIME SUSPECT (found by reading the code): the CSP connect-src in
  public/_headers listed the relay (wss + https) but NOT the three
  WalletConnect auxiliary hosts the modal needs to open a session:
  verify.walletconnect.com, explorer-api.walletconnect.com,
  api.web3modal.org. Those were already flagged unconfirmed in §5.
- SECOND BUG found by the same test: the header badge, hero note and
  footer HARDCODED "Contract not deployed" — only StatsPanel was
  gated on the live state, so the site contradicted itself (header
  "not deployed" vs Collection Status "Live on BSC Mainnet").
- FIX APPLIED 19 Nov ~11:15 IST (local, build exit 0, lint 0 errors,
  new bundle index-BCveldsF.js): the three auxiliary hosts added to
  connect-src (with a NOTE comment), and App.tsx / Hero.tsx /
  Footer.tsx now gate their badges on CONTRACT_DEPLOYED (emerald
  "Live on BSC Mainnet" when deployed, amber fallback otherwise).
  The lint shows 1 pre-existing React Compiler note (set-state-in-
  effect, unrelated to this change). NOT YET DEPLOYED — needs a fresh
  Cloudflare token, then preview redeploy + WalletConnect re-test,
  then production.

## 16. Fix deploy to preview — LIVE 19 Nov 2026 ~11:22 IST (parent-verified)
- Token trouble first: the "aurum-pages-deploy-2" token as first
  reported was rejected ("Invalid API Token") — a single misread
  character (digit 0 reported, capital O on the page). The browser
  task re-read it from the still-open success page (three reads,
  field + example curl identical); the corrected value verified
  "valid and active". LESSON: token values with 0/O and 1/I/l are
  easy to misread — always run tokens/verify before deploying.
- Preview deploy 3f8eb05f-db2a-46e6-b2c6-192afcc3c19c (11,113 uploaded
  / 76 present, 359.37 MiB) — live-verified: index 200, new bundle
  index-BCveldsF.js with the contract address inlined, gallery-index
  5,555, artwork #1/#5555 SHA-256 identical to local v3, and the
  served CSP connect-src now includes verify.walletconnect.com,
  explorer-api.walletconnect.com and api.web3modal.org.
- WalletConnect re-test on preview BLOCKED 19 Nov ~11:22 IST: the
  device browser (user's Chrome) was not available when the task was
  started. The re-test still needs a browser — device browser when it
  returns, or the cloud browser with the user's approval (the QR can
  still be scanned from a phone wallet either way).

## 17. WalletConnect re-test on preview — STILL FAILING 19 Nov 2026 ~11:40 IST
- Badge fix CONFIRMED on preview (deploy 3f8eb05f): header, hero,
  Collection Status and footer all read "Live on BSC Mainnet"; live
  data correct (12 minted, paused). Modal order exact.
- WalletConnect QR STILL does not appear on preview (cloud browser):
  button stuck on "WAITING…" for 35s, retried after reload, same
  silent hang, no error text at all. The CSP change did NOT resolve
  it in this browser.
- DECISIVE DIAGNOSTIC (Node repro, same project ID / relay /
  metadata as the site): a temporary script (wc-repro.mjs, deleted
  after) using @walletconnect/ethereum-provider 2.26.0 produced a
  valid wc: URI in 1.9s. So the Reown project, the relay and the SDK
  flow are all PROVEN working — the failure is browser-side, not the
  project or the relay. The cloud browser most likely cannot reach
  the relay WebSocket at all (silent hang, no error). The first
  failure (user's Chrome, production, old CSP) was an explicit
  "Failed to publish custom payload" — cause still unknown; it may
  have been the old CSP or a transient relay issue.
- NEXT: the decisive test is the user's Chrome on the PREVIEW site
  (new CSP). Their Chrome was unavailable at 11:22 IST, so this
  waits for it to return. If the QR appears there, the CSP fix
  worked and the fix ships to production. If it still fails there,
  the next step is a DevTools console/network check in their browser.
- SECOND COPY FIX applied 19 Nov ~11:45 IST (build exit 0, lint 0
  errors, bundle index-BXIJ5qoF.js, NOT YET DEPLOYED): the remaining
  hardcoded "not deployed" copy is now gated on CONTRACT_DEPLOYED —
  LiveChecks header badge + intro + tx-lookup note, PromptCenter
  "Requires deployed contract" badges (hidden when deployed),
  Footer disclaimer paragraph, Gallery detail-modal label. MyNFTs /
  ActivityFeed / MintPanels were already properly gated.

## 18. WalletConnect re-test in user's Chrome on preview — STILL FAILING 19 Nov 2026 ~11:48 IST
- Decisive test ran in the user's Chrome on preview (11:43-11:48 IST,
  task completed): header badge LIVE, live data correct (12 minted,
  paused). WalletConnect clicked twice — both attempts hung on
  "WAITING…" for 60-120s, then the SAME error as production:
  "Connection failed: Failed to publish custom payload, please try
  again." (two different session ids). QR never appeared. No session
  connected. DevTools could NOT be opened by the task (Ctrl+Shift+J/I
  accepted but no panel appeared; F12 unavailable), so no console
  evidence.
- CSP DEFINITIVELY RULED OUT: the live preview response headers were
  fetched and checked — connect-src contains wss://relay.walletconnect.com,
  https://relay.walletconnect.com, verify.walletconnect.com,
  explorer-api.walletconnect.com and api.web3modal.org. The relay is
  allowed.
- wagmi's connect() flow was read from the installed package and
  matches the working Node repro (same provider.connect() call;
  optionalChains [56] is the only difference and cannot break a
  publish). So the failure is NOT a code difference.
- REMAINING SUSPECTS: (a) corrupted persisted WalletConnect state in
  the browser's localStorage (wc@2:* keys) left by the first failed
  attempt — the SDK reuses stored keys/pairings and a stale one makes
  every later publish fail deterministically; (b) the user's network
  or a Chrome extension blocking the relay WebSocket (wss).
- NEXT STEP (needs the user, 30s): on the preview site, press F12,
  Console tab, paste:
  Object.keys(localStorage).filter(k=>k.startsWith('wc@2')).forEach(k=>localStorage.removeItem(k))
  then reload and click WalletConnect again. If the QR appears, the
  cause was stale state. If it still fails, the relay WebSocket is
  blocked on their network/Chrome.

## 19. Console evidence from the user — ROOT CAUSE FOUND 19 Nov 2026 ~11:57 IST
- The user pasted their Chrome console output from the preview site:
  (a) 9x `POST https://bsc-rpc.publicnode.com/ 403 (Forbidden)` —
  PublicNode is refusing the site's RPC posts; the viem fallback
  transport is handling it (reads still worked via dataseed), so
  this is noise, not the WalletConnect cause.
  (b) 6x CSP connect-src violations (blocked URL redacted by the
  user) — the blocked hosts are the two the SDK itself calls but
  connect-src did not list: verify.walletconnect.ORG (the SDK's
  attestation server — .com alone is not enough; confirmed in the
  installed @walletconnect/core source, which uses
  https://verify.walletconnect.org/v3) and echo.walletconnect.com
  (pairing-event client). FIX APPLIED LOCALLY: both added to
  connect-src in public/_headers (build exit 0, lint 0 errors —
  bundle unchanged in name, new dist built after §18).
  (c) `Uncaught (in promise): The source
  https://aurum-agents-preview.pages.dev/ has not been authorized
  yet` — THIS is the WalletConnect failure. The message comes from
  the Verify server, not the SDK source (no such string in the
  installed packages): the preview origin is NOT authorized in the
  Reown Cloud project "AURUM AGENTS", so the session proposal is
  refused before any QR can be produced. This also explains the
  Node/browser split: in Node there is no page origin for the
  Verify check to enforce, so the same project/relay produced a
  URI in 1.9s; in any real browser the origin check applies — and
  it failed on production too, which means aurumagents.pages.dev
  is evidently not authorized either (or the project restricts
  origins to a list that contains neither).
- FIX (needs the user — it is their Reown account, Google
  v15099261@gmail.com): in cloud.reown.com, open the AURUM AGENTS
  project and add BOTH domains to its allowed origins / app
  domains: aurumagents.pages.dev and aurum-agents-preview.pages.dev.
  Then reload the preview site and click WalletConnect — the QR
  should appear. The stale-localStorage clear is NO LONGER NEEDED
  (the cause is the origin authorization, not stored state).
- The CSP fix (b) and the copy fixes (§17) ride with the next
  deploy; the Reown allowlist fix is independent of any deploy.

## 20. Second console paste + Reown allowlist task 19 Nov 2026 ~12:00 IST
- User pasted one more console line: framing
  'https://verify.walletconnect.org/' was blocked by
  "default-src 'self'" (frame-src not set, so default-src applies).
  The SDK frames the verify page as part of its flow. FIX APPLIED
  LOCALLY: frame-src https://verify.walletconnect.org
  https://verify.walletconnect.com added to the CSP in public/_headers
  (build exit 0, lint 0 errors; dist/_headers verified). Rides with
  the next deploy.
- User approved "Add both site addresses in Reown for me" — a device
  browser task (cloud.reown.com, user's Chrome) is running to add
  aurumagents.pages.dev + aurum-agents-preview.pages.dev to the
  AURUM AGENTS project's allowed origins. Awaiting its result.

## 21. Reown allowlist DONE 19 Nov 2026 ~12:03 IST — Cloudflare token LOST
- Device browser task (cloud.reown.com, signed in as
  v15099261@gmail.com): the AURUM AGENTS project's Domain allowlist
  previously showed "No domains added yet". Both domains added and
  confirmed: https://aurumagents.pages.dev ("successfully
  allowlisted") and https://aurum-agents-preview.pages.dev
  ("successfully allowlisted"). The allowlist now shows exactly
  those two entries. No other setting changed, no project created.
- CAVEAT from Reown: each confirmation said the change "May take 6
  hours to reflect" — the QR may not appear immediately even with
  the allowlist fixed.
- BLOCKER for the next deploy: /tmp/cf-token-aurum2 is GONE (VM
  restart wiped /tmp; verified 12:03 IST — no cf-token files
  remain). A fresh Cloudflare token is needed before the updated
  dist (CSP verify.org/echo/frame-src + copy fixes, bundle
  index-BXIJ5qoF.js) can be deployed to preview. Same fresh-token
  browser flow as before (Pages:Edit + Account:Read); always run
  /user/tokens/verify before deploying.

## 22. Fresh token + preview redeploy + WalletConnect re-test 19 Nov 2026 ~12:07-12:10 IST
- Fresh Cloudflare token "aurum-pages-deploy-3" created in the user's
  Chrome (Pages:Edit + Account:Read, no expiry, no IP restriction).
  Value verified via /user/tokens/verify ("valid and active") before
  use; the value is recorded NOWHERE, temp file /tmp/cf-token-aurum3
  mode 600 — delete after the production deploy.
- Preview deploy 960dc9d1-4234-4141-884c-e8ed11560521 (11,113 uploaded
  / 76 present, 5,555 substitutions) — live-verified: index 200,
  bundle index-BXIJ5qoF.js, CSP served with verify.org + echo +
  frame-src, gallery-index 5,555, artwork #1/#5555 SHA-256 identical
  to local v3, metadata image substituted to the preview domain.
  This dist carries the full CSP fix (§19-20) + the copy fixes (§17).
- WalletConnect re-test started in the user's Chrome on preview
  (~12:10 IST) — tests the Reown allowlist (§21) + the new CSP
  together. Awaiting its result. If the QR appears: deploy this
  dist to production, live-verify, delete the token file. If it
  still fails: the Reown 6-hour propagation window is the prime
  suspect.

## 23. WalletConnect re-test after allowlist + CSP fixes — STILL FAILING 19 Nov 2026 ~12:13 IST
- Re-test in the user's Chrome on preview (12:09-12:13 IST, 2
  attempts): QR still never appears; same error both times:
  "Connection failed: Failed to publish custom payload, please try
  again." (different session ids). No session connected.
- PROGRESS: the "not authorized yet" error is GONE, and no CSP
  violation appeared — the Reown allowlist fix and the CSP fix both
  took effect at their layers. The copy fixes are confirmed live on
  preview ("Contract not deployed" appears nowhere; footer reads
  "AURUM AGENTS is live on BNB Smart Chain Mainnet."). The failure
  is now isolated to the relay publish step.
- REMAINING EXPLANATIONS: (a) the allowlist change is still
  propagating — Reown said up to 6 hours, and the allowlist was
  added only ~10 min before this test (~12:01 IST, so the window
  ends ~18:01 IST); (b) the relay WebSocket (wss://
  relay.walletconnect.com) is blocked on the user's network or by a
  Chrome extension.
- DECISIVE 30-SECOND CHECK (user, F12 Console on the preview site):
  let s=new WebSocket('wss://relay.walletconnect.com');
  s.onopen=()=>console.log('RELAY WS OPEN');
  s.onerror=()=>console.log('RELAY WS ERROR');
  setTimeout(()=>console.log('state:', s.readyState), 5000);
  readyState 1 = reachable (cause is propagation — wait and
  re-test); 3 = blocked on their network/extension.
- NEXT: re-test WalletConnect after ~18:05 IST. If it still fails
  then, the cause is NOT the allowlist.

## 24. Relay diagnostic DECISIVE + PRODUCTION LAUNCH 19 Nov 2026 ~12:20-12:25 IST
- Relay diagnostic page (public/relay-test.html + relay-test.js,
  deployed to preview as f83d7337, live-verified 200) run in the
  user's Chrome 12:18-12:20 IST: relay WebSocket CLOSED, readyState
  3 — the handshake to wss://relay.walletconnect.com never
  completes from the user's browser. Stored WalletConnect data: 0
  keys (stale state was NOT the cause; the clear removed 0 keys).
  The retry on the main preview site hung on WAITING again, no QR.
- CONCLUSION: the user's Chrome/network cannot reach the
  WalletConnect relay at all. The site, project, allowlist and CSP
  are all proven correct (Node repro produces a QR in 1.9s; the
  "not authorized" error is gone; no CSP violations). WalletConnect
  will work for users whose networks reach the relay. On the user's
  machine the fixes to try are: an Incognito window (extensions
  off — an ad-blocker/privacy extension is a prime suspect) or a
  different network (mobile hotspot).
- PRODUCTION DEPLOYED 19 Nov ~12:23 IST (deployment
  93fd5bc4-98ce-4d15-9ae3-4361c44cd340) with the same verified build
  (bundle index-BXIJ5qoF.js) — live-verified: index 200, full CSP
  (verify.org + echo + frame-src), gallery 5,555, artwork #1/#5555
  SHA-256 identical to local v3, metadata image substituted to the
  production domain. The diagnostic page was removed from public/
  before this deploy (preserved at docs/walletconnect-relay-test/);
  production /relay-test.html returns the app shell (SPA fallback),
  not the diagnostic page. Token file /tmp/cf-token-aurum3 deleted
  after use.
- LAUNCH STATUS: the project is live at https://aurumagents.pages.dev
  with the contract deployed + verified + paused (12 minted,
  1,099 free remain). MetaMask and Binance Web3 Wallet (injected)
  connect fine; WalletConnect depends on the visitor's network
  reaching the relay.

## 25. UNPAUSED 19 Nov 2026 ~12:29 IST — minting is LIVE
- User tapped "Unpause minting". Browser task in the user's Chrome
  (Remix, flattened contract, MetaMask Account 16) called
  unpause(); the owner signed in MetaMask. Tx
  0x20846868122540833b45cd37576a5d062ce8bcdadde5095bef71c426d93e2eb8,
  block 134459414, status Success, gas 27,741, fee 0.00000138705 BNB
  at 0.05 gwei. Verified independently via cast: paused() = false,
  freeMinted still 12, tx on-chain from the owner, chain 56.
- Minting (free + paid) is now OPEN at https://aurumagents.pages.dev.
  1,099 free and 4,444 paid remain. Note: the earlier free mints
  went to bots within minutes of deploy — watch the mint rate.

## 26. Multisig signers generated 19 Nov 2026 ~12:36 IST — AWAITING KEY IMPORT
- User chose "generate them" for the two extra 2-of-3 signers.
  Generated with cast wallet new:
  - Signer 1 (existing owner): 0x86e10a0763A2BA16Fb0B34CD6B3BbD5726295c2E
  - Signer 2: 0x6eb98F9348575E5d7212eA2217DDb9B112f7b455
  - Signer 3: 0x4f357a49e7e74Cc365DbfcdA29b4846205ADd4Cb
- Private keys stored ONLY in repo/contracts/.env.multisig-signer{2,3}-2026-11-19
  (mode 600, gitignored via .env.*). Key VALUES are recorded NOWHERE else
  and were never printed in chat. (Note: cast prints the keypair to
  stderr when piped; the files were verified to hold address +
  66-char private key each.)
- HARD GATE: the user MUST import both private keys into MetaMask
  (or otherwise hold them) BEFORE any ownership transfer. A 2-of-3
  whose signers the owner cannot sign with cannot approve anything
  and the contract would be permanently unmanageable. Do NOT call
  transferOwnership until the user confirms both keys are imported.
- NEXT (after confirmation): create the Safe on BSC via app.safe.global
  in the user's browser (user signs creation), then transferOwnership
  from the current owner wallet via Remix (user signs), then verify
  owner() == Safe address on-chain.

## 27. Dependency audit 19 Nov 2026 ~12:41 IST — npm audit STILL blocked, OSV substitute done
- npm audit retried on this VM: STILL 403 policy_denied on
  POST registry.npmjs.org/-/npm/v1/security/audits/quick
  (policy zz_managed_internal_spaces_package_registries). The literal
  `npm audit` still needs the user's machine or another environment.
- Substitute run instead: all 484 unique deps from package-lock.json
  (lockfile v3) queried against the OSV database (api.osv.dev
  querybatch). Result: 1 advisory.
  - zod@3.25.76 — GHSA-mrhx-c7xc-m3w5 (CVSS 3.1 AV:N/AC:L, availability
    only): Zod array validation can exhaust memory on a large array
    submitted to a schema without a length cap. Fixed in 4.6.6 (v4 line).
  - Assessment: zod is TRANSITIVE only (via @coinbase/cdp-sdk,
    @reown/appkit/abitype, @walletconnect/utils, @x402); NOT a direct
    dependency. The site is a static frontend with no backend and no
    server-side validation — there is no attacker-reachable validation
    surface, so this is not exploitable here. No code change made.
    The @x402 packages already resolve zod ^4.6.6 (fixed). A v3->v4
    bump across the wallet stack is not warranted for this finding.
- Verdict: no blocking vulnerability in the frontend dependencies.
  (npm audit itself remains unrun — re-run it on the user's machine
  when convenient; it is no longer a launch blocker.)

## 28. Safe multisig CREATED 19 Nov 2026 ~12:43 IST — ownership transfer STILL HELD
- 2-of-3 Safe created in the user's Chrome via app.safe.global; the
  user signed the creation in MetaMask (Account 16).
  Safe address: 0x25C2f43977d4eb35C4aB22164e679E89eed162CA
  (Safe 1.5.0+L2 proxy). Creation tx
  0x4fbff23f5aaa5075dd2473669b680795ca2804212d1b1078ea844d866a890e80,
  block 134461294, fee 0.00001531 BNB (~$0.009).
  Owners (verified in Safe app Settings > Setup): signer 1
  0x86e10a0763A2BA16Fb0B34CD6B3BbD5726295c2E, signer 2
  0x6eb98F9348575E5d7212eA2217DDb9B112f7b455, signer 3
  0x4f357a49e7e74Cc365DbfcdA29b4846205ADd4Cb; threshold 2 of 3.
  Verified independently via cast: code present at the Safe address,
  creation tx on-chain from the owner, getThreshold() = 2.
- NOT DONE: transferOwnership of the NFT contract to the Safe.
  Still HELD on the hard gate from §26 — the user must import the
  signer 2 + 3 private keys into MetaMask and confirm first. Until
  then the current owner wallet remains sole owner of the contract.

## 29. Ownership TRANSFERRED to the Safe 19 Nov 2026 ~12:57 IST — multisig complete
- transferOwnership called in Remix by the previous owner (Account 16),
  user-signed in MetaMask. Tx
  0x19c57fe31e874870e2ace4e7328fb68e63bb36020656ad28f657216815d40164,
  block 134463138, status Success, gas 28,653, fee 0.00000143265 BNB,
  OwnershipTransferred event emitted. Verified independently via cast:
  owner() = 0x25C2f43977d4eb35C4aB22164e679E89eed162CA (the 2-of-3 Safe),
  tx on-chain from the previous owner, paused() = false,
  freeMinted still 12.
- From now on, every owner action (pause/unpause, withdraw, baseURI,
  ownership) needs 2 of the 3 Safe signers to approve in the Safe app.
  The previous owner wallet alone can no longer act. Note for the
  site: the admin panel is owner-gated, so it will no longer show
  controls for Account 16 — owner actions happen in the Safe app.

## 30. Launch ANNOUNCED on X 19 Nov 2026 ~13:06 IST
- Launch post published from @ARCProof_xyz in the user's Chrome.
  Post: https://x.com/ARCProof_xyz/status/2123319391588909148
  Text (as approved, contract address added at the user's request):
  "AURUM AGENTS is live on BNB Smart Chain. 5,555 unique NFTs —
  1,111 free (1 per wallet), 4,444 at 0.001 BNB. Minting is open now.
  https://aurumagents.pages.dev Contract:
  0x16dE59897fDeE7F34377C2302dC4e9FDb12168C2 Verified on BscScan,
  ownership secured by a 2-of-3 multisig." X confirmed "Your post
  was sent"; the post was opened and shows the full text, the
  contract address, @ARCProof_xyz, timestamp 1:06 PM Nov 19, 2026.

## 31. Marketplace indexing check 19 Nov 2026 ~13:18 IST (cloud browser)
- OpenSea: NOT viewable, BSC listing CLOSED. Asset URL redirects to
  "Page not found"; site search "AURUM AGENTS" = no results. OpenSea
  Help Centre (updated 9 Nov 2026) lists 27 supported chains — no
  BNB/BSC. No route to import an existing BSC contract. SKIP.
- AirNFTs: NOT indexed, and NO import path for an existing contract.
  Items must be re-minted through AirNFTs itself. Site looks dormant
  (footer copyright 2022, dead verification form). SKIP — re-minting
  the collection elsewhere is out of scope.
- Element Market: COULD NOT BE CHECKED — element.market returns a hard
  Cloudflare block from the cloud browser (no puzzle/button; reloads
  failed). From Element's own docs: a collection is self-listed by
  connecting a wallet as the contract owner's address, then My Profile
  -> My Collections, edit + Submit. Verification needs 50 ETH volume
  (or 999/599 USDT accelerated) — NOT free, skip verification. Basic
  self-listing appears free. NOTE: the contract owner is now the Safe,
  so the listing wallet must be the Safe (via Safe WalletConnect) or
  the check must run in the user's Chrome. RETRY from the user's
  Chrome after the NFT Calendar submission finishes.
- Net: for a BSC collection in Nov 2026, the realistic free venues
  are the drop calendars (NFT Calendar etc.) + Element self-listing.
  OpenSea/Binance NFT/tofuNFT/Magic Eden-BSC are all closed for BSC.

## 32. Boltbook.fun — checked 19 Nov 2026 ~13:22 IST
- Boltbook is a content-mining forum for Binance AI agents. Only wallets
  holding a Binance .ai Agent ID (SPACE ID Agent ID, BSC registry
  0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F) can post, comment, vote,
  create boards. Alphapedia = one wiki page per project ("your human's
  projects first"); b/launch is the launch board. Posts earn BOLT.
- Join: read skill.md, sign in with one EIP-712 signature (no gas),
  via the Binance Agentic Wallet holding the .ai ID; API key bb_...
  saved after. Sign-in is a signature, never a transfer/approval.
- On-chain check 19 Nov ~13:22 IST: neither of the user's known BSC
  wallets holds an Agent ID — Account 16 (0x86e1...) balanceOf = 0,
  MetaMask test wallet (0xa7C3...) balanceOf = 0. User's Binance App
  Agentic Wallet address unknown — if it holds an ID, posting is
  possible after the EIP-712 sign-in in the Binance App. If no ID
  exists, claim one first in the Binance App (Wallet -> Agent ID
  banner -> pick a .ai name -> bind to Agentic Wallet).
- No posting done yet — gated on the Agent ID question.

## 32b. Boltbook Agent ID VERIFIED 19 Nov 2026 ~13:26 IST
- User's .ai Agent ID: prasadreddy.ai. Resolved on-chain via the SPACE ID
  Agent ID registry 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F:
  ownerOf(keccak("prasadreddy")) = 0x2DB8be71CCdAa91f578721378fbA05F6EE198686,
  handleOf = "prasadreddy", balanceOf = 1. VERIFIED.
- Join flow (boltbook.fun/skill.md, v0.25.188): POST /api/v1/agents/challenge
  {wallet} -> EIP-712 Login typed_data (10 min) -> sign via `baw` CLI
  (Binance Agentic Wallet, Developer Mode ON in Binance App) ->
  POST /api/v1/agents/register -> api_key bb_... (shown once, save to
  ~/.config/boltbook/credentials.json). Fallback if signing fails: 0 BNB
  tx to self with tx_proof.input_data, register with tx_hash (gas only).
- Posting: POST /api/v1/posts {board, title, content, url}. Alphapedia =
  one wiki page per project, human's projects first. b/launch = launch
  board. Every post/comment gets a verification challenge to answer
  within 5 min (2-decimal number via POST /verify).
- NOT joined yet — needs the baw CLI link + Developer Mode in the user's
  Binance App, or the site's Join UI in their Chrome.

## 33. NFT Calendar submission DONE 19 Nov 2026 ~13:31 IST
- Submitted to https://nftcalendar.io/events/community/add/ on the FREE
  plan ($0, Standard moderation queue, review in 4-5 days). No payment
  details entered. Event URL: https://nftcalendar.io/event/aurum-agents/
  — verified live, shows "still in moderation queue". Status notices go
  to v15099261@gmail.com. No confirmation number given.
- Submitted: title AURUM AGENTS; description = approved wording expanded
  to the form's 120+ word guidance (facts only); date 19-11-2026 (no time
  field); BNB Chain; website https://aurumagents.pages.dev; source
  https://x.com/ARCProof_xyz/status/2123319391588909148; Twitter
  https://x.com/ARCProof_xyz. Cover image = compressed JPEG
  (aurum-launch-post-1600x900.jpg, 262 KB) — the 1.1 MB PNG exceeded the
  form's 1 MB limit. Marketplace left BLANK (fixed dropdown, no Other /
  own-website option; project mints on its own site). Contract address,
  Discord, category tags also blank (not supplied).
- NOTE for future forms: the launch graphic PNG is 1.1 MB; use the
  262 KB JPEG for any form with a 1 MB cap.
- Next: NFT Evening, then NFT Drops Calendar. Element self-listing
  still to retry from the user's Chrome (owner is the Safe).

## 34. NFT Evening submission FAILED 19 Nov 2026 ~13:42 IST
- NFT Evening NO LONGER HAS a free drop/event submission form. Calendar
  at https://nftevening.com/calendar/ is empty ("No events found",
  Upcoming + Past) with only 8 "Reserved Slot" placeholders; no submit
  button anywhere (menu, page, site search for "submit drop"/"submit
  event"). The free creation page /new-event-to-calendar/ (linked from
  /promote-event-page/ as "You can create your event here") redirects
  to the homepage. /submit-nft-drop/, /submit-event/, /events/,
  /events/community/add/, /calendar/submit/ all 404; /advertise/ 404.
- Remaining routes (NOT used — only the form was authorised): Contact
  Us form (600-char limit), advertising@nftevening.com, Telegram
  @nfteveningads. User to decide: email/contact them, or leave NFT
  Calendar as the only launch-platform listing.
- Nothing submitted, no account created, no payment entered.

## 35. NFT Drops Calendar submission FAILED 19 Nov 2026 ~13:52 IST
- Site DOWN: https://nftdropscalendar.com/ returns Cloudflare Error
  525 "SSL handshake failed" on every attempt over ~10 min (reload,
  www, plain http — all the same; Ray ID a5cdceb3fb36c8c2 at 08:22 UTC).
  Fault is on the site's origin server (SSL/TLS), not a bot check or
  sign-in wall. Nothing submitted, no account, no payment, image not
  uploaded. All listing details ready — RETRY once the site is back.

## 36. baw sign-in VERIFIED 19 Nov 2026 ~13:54 IST
- `baw auth verify` (qrCodeId 38b3a1c9..., pairing aea9ba) -> SUCCESS.
  `baw wallet status` -> CONNECTED. `baw wallet settings` ->
  devMode.enabled = true (expires 2026-11-26T11:03:52+05:30, daily
  limit 1000), session expires 2026-11-21T13:53:52+05:30 (48h),
  dailyLimit 50000, abnormalTxnHandling NeedConfirmation.
- Wallet: Binance Agentic Wallet holding prasadreddy.ai
  (0x2DB8be71CCdAa91f578721378fbA05F6EE198686). Next: Boltbook join —
  POST /api/v1/agents/challenge, EIP-712 sign via baw sign-message,
  POST /api/v1/agents/register, save bb_ key to
  ~/.config/boltbook/credentials.json (mode 600, never print).

## 37. Boltbook JOINED + POSTED 19 Nov 2026 ~14:06 IST
- baw CLI 1.12.0 installed locally in ~/workspace/boltbook/node_modules/
  (skill binance-agentic-wallet v1.15.0 at ~/workspace/boltbook/.agents/
  skills/binance-agentic-wallet/). Sign-in verified: wallet CONNECTED,
  devMode.enabled = true (expires 26 Nov 2026), session 48h to 21 Nov.
- Boltbook join: EIP-712 Login challenge nonce 9220e28c..., signed via
  baw sign-message (first preview expired; re-preview + execute ->
  COMPLETED, signatureRecovery 01), POST /agents/register -> agent
  prasadreddy (display prasadreddy.ai), profile
  https://boltbook.fun/u/prasadreddy, status active. API key saved ONLY
  in ~/.config/boltbook/credentials.json (mode 600) — never print it.
  (Account already existed since 6 Nov 2026, 4 earlier posts, karma 15.)
- Alphapedia project CREATED: https://boltbook.fun/alphapedia/aurum-agents
  (slug aurum-agents, kind nft, BNB Chain, contract, website, X
  @ARCProof_xyz, EN + ZH summaries, human_directed true, +3 points).
  Data entry id 11946 (+1) with the on-chain proof. Icon uploaded
  (256x256 PNG redrawn from the project's own favicon.svg, 1,922 bytes,
  https://boltbook.fun/alpha-icon/474, +0.5).
- b/alpha launch post PUBLISHED: https://boltbook.fun/p/otUt3kJOLAHG
  (id otUt3kJOLAHG, status visible). Verification challenge solved
  (54 + 7 = 61.00) within the 5-min window. NOTE: b/launch is ONLY for
  launching a token on flap.sh via !launch — NOT used for this NFT
  announcement; b/alpha is the right board for the story.

## 38. NFT Evening — SKIPPED by user 19 Nov 2026 ~14:14 IST
- User tapped "Skip NFT Evening". Free submission form no longer exists;
  email/contact-form routes not pursued. Closed.

## 39. More free listing platforms — searched 19 Nov 2026 ~14:22 IST
- DappRadar: FREE listing, dappradar.com/developers, NFT category,
  contract-based, ~30 min per their own guide. Strongest new option.
- CoinGecko NFTs: FREE via Partners Platform (partner.coingecko.com),
  "New NFT" request, review within 5 working days. Caveat: NFT hub
  tracks trading stats — a collection with no secondary sales yet may
  not pass; application costs nothing. Needs a CoinGecko account.
- Today NFT News: free "Add New Event" form per search results — SITE
  DOWN: domain does not resolve (DNS NXDOMAIN, 4 browser attempts incl.
  homepage + curl HTTP 000, 19 Nov ~14:22 IST). Not submittable now;
  retry later. The similar nftnewstoday.com is a different site.
- Ruled out: NFT Plazas (free listing mentioned, $15 verified upsell,
  route unclear), UpcomingNFT.art + DropCurrent (paid), Benzinga
  (paid/curated), Flowverse (Flow only), nfts.auction (artist drops),
  press-release farms. Marketplaces excluded per user's brief
  (OpenSea closed for BSC; Rarible = re-minting, not listing).

## 40. DappRadar — BLOCKED 19 Nov 2026 ~14:51 IST (bot wall)
- Submission NOT made. In the user's Chrome DappRadar serves a stripped,
  non-interactive site: no "Sign in" button anywhere, /developers
  redirects home, /submit-a-project shows only a heading + empty bar
  (form never renders), /dashboard/submit-dapp redirects home when
  logged out, /login -> /wp-login.php renders blank and crashes the tab
  (reproduced 3x); /signin, /auth, /auth/login, /developers/login are
  404. No explicit CAPTCHA/Cloudflare message shown — cause unproven.
  Cloud browser also hit a Cloudflare check on /developers. Nothing
  filled in, submitted, paid, no account created. Logo + banner unused.
- Form requirements learned from DappRadar's own guide: sign in (email /
  Google / wallet), verify email, "Submit project" in dashboard; fields:
  name, 250x250 logo under 150 KB, website, socials, short description
  max 160 chars, full description, categories + up to 5 tags, chain +
  contract, up to 3 screenshots, captcha; decline the Premium for
  Developers upsell. Google account visibly signed in to this browser is
  win200kdaily@gmail.com ("Win Money"), NOT v15099261@gmail.com — a
  Google sign-in would need an account switch.
- Next step: user opens the form themselves (tab left on
  /submit-a-project) and signs in with v15099261@gmail.com, or hands
  control back after signing in, or retry later.

## 41. DappRadar — CLOSED by user 19 Nov 2026 ~14:57 IST
- User: "DappRadar submission not available bro". Retry window closed at
  their word; no further DappRadar attempts. Submission was never made.

## 42. CoinGecko — SUBMITTED 19 Nov 2026 ~15:39 IST
- Free NFT listing request submitted via the CoinGecko Request Form
  (Google Form); confirmation "Your response has been recorded." No
  reference number issued; review up to 5 working days per CoinGecko's
  guide. No Fast Pass / paid upgrade.
- Submitted: email v15099261@gmail.com, BNB Smart Chain, contract
  0x16dE59897fDeE7F34377C2302dC4e9FDb12168C2, website
  https://aurumagents.pages.dev entered in the "OpenSea/NFT Exchange
  Listing Page" field (no exchange listing exists — minting only on the
  project's own site), short description, Twitter @ARCProof_xyz.
  Acknowledgements ticked (NFT category only; no Fast Pass).
- Session was already signed in to partner.coingecko.com as
  prasad.kalyanreddy@gmail.com. One-time account setup completed first:
  Prasad Nimmakayala, AURUM AGENTS, business type NFT, website, India.
  NOTE: the Google Form itself showed the signed-in account
  win200kdaily@gmail.com, though the contact email entered was
  v15099261@gmail.com. The form has no logo/banner upload fields, so
  the logo PNG + cover JPEG were not attached. The "New NFT" option
  opens an external Google Form, so the request does not appear in the
  Partners Platform submissions list ("No Data").

## 43. X profile bio + website — EDITED 19 Nov 2026 ~15:43 IST
- @ARCProof_xyz (display "ARC//PROOF nub"). Bio before: "ARC//PROOF —
  5,555 unique 1/1 NFTs. Identity, verification, ownership, on-chain
  history. $APROOF" (96 chars); website arcproof.xyz.
- Bio after (159/160 chars): "ARC//PROOF — 5,555 unique 1/1 NFTs.
  Identity, verification, ownership, onchain history $APROOF
  AURUM AGENTS — 5,555 NFTs on BNB Chain 1,111 free. Minting live."
  (3 punctuation marks dropped to fit: hyphen in "on-chain", full stop
  after "history", comma after "Chain".) Website now
  https://aurumagents.pages.dev. Name, username, pic, banner, location,
  birth date unchanged; nothing posted/pinned/liked/followed/deleted.
- User then asked about profile name + username, profile pic + banner
  (19 Nov ~15:43 IST) — pending their answer on the new name/handle.

## 44. X profile rebrand — DONE 19 Nov 2026 ~15:53 IST
- @ARCProof_xyz fully rebranded to AURUM AGENTS (bio + website edit
  §43, then pic/banner/name in the same browser task).
- Profile pic: gold diamond logo (aurum-icon-256.png). Banner: new
  purpose-built 1500x500 file repo/docs/aurum-x-banner-1500x500.jpg
  (black/gold, title + facts + URL + #108 artwork; the 1600x900
  launch graphic was tried first and discarded — its crop cut the
  title). Display name: "AURUM AGENTS". Bio (110/160 chars):
  "AURUM AGENTS — 5,555 robot NFTs on BNB Chain. 1,111 free (1 per
  wallet), 4,444 at 0.001 BNB. Minting live now." All ARC//PROOF
  wording and $APROOF removed. Website
  https://aurumagents.pages.dev. Username @ARCProof_xyz UNCHANGED
  (user has not named a new handle; changing it breaks the launch
  post, Boltbook and CoinGecko links). Nothing posted/pinned/liked.
- Cosmetic note: on the live profile the avatar circle overlaps the
  banner's lower-left corner (standard X layout) — the URL line at
  the banner's bottom left sits partly behind it; the website link
  field carries the URL anyway.

## 45. X username changed to @AurumAgents — DONE 19 Nov 2026 ~16:09 IST
- Handle changed from @ARCProof_xyz to @AurumAgents (first choice, no
  fallback needed). New profile: https://x.com/AurumAgents.
  Display name AURUM AGENTS, bio, website, pic, banner unchanged by
  this step. X required a password confirmation to reach the username
  field; the user entered it themselves in their own browser, then
  handed control back and the change was set and verified on the live
  profile. Nothing posted/pinned/liked.
- Consequence: old-handle X URLs redirect to the new handle on X
  itself, but the Boltbook Alphapedia entry, CoinGecko request and NFT
  Calendar event still record @ARCProof_xyz as the X handle.

## 46. Live-site copy fix + X link — DEPLOYED 19 Nov 2026 ~16:27 IST
- User reported the live site still showed pre-launch wording (hero
  "Mint — coming soon", footer "Stage 2 · brand + generative artwork
  + website template"). Both were unconditional strings in the old
  build; the X-link build had never deployed.
- Changes (frontend/src/components/Hero.tsx, Footer.tsx): hero
  button "Mint — coming soon" -> "Mint now"; footer line -> "Live on
  BNB Smart Chain Mainnet · Contract verified on BscScan · Built with
  free, open-source tools."; X link "Follow on X — @AurumAgents"
  (https://x.com/AurumAgents) added to hero buttons + footer.
- Build clean (11.30s/6.77s runs), new bundle index-Bmvn06YK.js.
- Fresh token "aurum-pages-deploy-4" created in the user's Chrome
  (Pages:Edit + Account:Read); verified "valid and active" via
  /user/tokens/verify (token id c13f677afbb6cc46e5bc9305ccd6fa58);
  value kept ONLY in /tmp/cf-token-aurum4 mode 600, deleted after
  the deploy. Production deploy c474e5ce-86db-48c8-b5b0-3cc459cd7e1f
  (11,189 files, 362.18 MiB, 5,555 substitutions, stage deploy /
  success). Live-verified on https://aurumagents.pages.dev: homepage
  200 serving index-Bmvn06YK.js, x.com/AurumAgents 2x in the live
  bundle, "Mint now" present, "coming soon" 0.
- Element Market: user directed "connect only metamask" 16:28 IST —
  the Safe QR scan is dropped; the Element task was told to connect
  MetaMask Account 16 only and use Element's create/contract flow.

## 47. Element Market — META-MASK-ONLY ATTEMPT FAILED 19 Nov 2026 ~16:31 IST
- User directed "connect only metamask" (16:28 IST); the Safe QR
  scan was dropped. MetaMask Account 16 connected to Element fine,
  but Account 16 is not the contract owner, so My Collections is
  empty and there is no route to register the existing contract.
- Element's Create -> contract flow
  (element.market/create/contract) is ONLY for deploying a brand-new
  drop contract (name/symbol/description/drop type/supply/mint
  stages, "Deploy Now") — no field for an existing contract address,
  no import option. NOT used: it would have created a different
  collection under a new contract. Nothing deployed, nothing paid,
  no signature attempted.
- Collection page still 404. The ONLY Element route is connecting
  the Safe (owner) via WalletConnect QR — user declined that path
  for now. CoinGecko form already carries the project website in
  the listing-page field, so nothing is blocked there.

## 48. Launch image posted on X — DONE 19 Nov 2026 ~16:45 IST
- Reply to the launch post, same thread, from @AurumAgents:
  https://x.com/AurumAgents/status/2123374593192890498
  (launch post https://x.com/AurumAgents/status/2123319391588909148,
  now shows 1 reply). Attached image is the 1600x900 launch graphic.
- Note: the user took over the browser mid-task and posted the
  reply themselves with their own wording (incl. #BNBChain #NFT
  #Web3 #AIAgents); the task did not post a duplicate.

## 49. Boltbook X handle — edit PROPOSED 19 Nov 2026 ~16:48 IST
- User chose item 2 from the rundown: update Boltbook from
  @ARCProof_xyz to @AurumAgents. Alphapedia field `x` confirmed
  still @ARCProof_xyz (GET /alpha/aurum-agents, live).
- Boltbook has no direct edit: the fix is an `edit` proposal.
  POST /api/v1/alpha/aurum-agents/proposals -> proposal id 875,
  status open, 0 yes / 0 no, closes 2026-11-20T11:18:41Z
  (~16:48 IST 20 Nov). Passes with 3+ approvals and twice as many
  approvals as rejections within 24h (5 approvals pass at once).
  The proposer cannot vote on their own proposal — it needs other
  agents' votes. If it passes, the page shows @AurumAgents; if it
  is rejected, re-propose.
- The b/alpha launch post (otUt3kJOLAHG) does not mention any X
  handle, so nothing to fix there.

## 50. More listing platforms searched 19 Nov 2026 ~16:53-16:59 IST
- User asked to search for any other listing platforms. Three new
  candidates found; none usable today.
- Rarity Sniper (raritysniper.com): free drops calendar, 650+
  collections, covers Binance per older sources, has a
  "Get Listed & Advertising" route at /get-listed (confirmed via
  its Linktree). DID NOT LOAD in the user's Chrome
  (DNS_PROBE_FINISHED_NXDOMAIN) — fee and chain coverage
  unverified. Retry the get-listed page once the domain resolves.
- NFTGO (nftgo.io): RETIRED. The drops page and homepage both
  show only "We'll come back soon!" — "we're building a new
  product, Minara.ai". No calendar, no submit form. Dead end.
- UpcomingNFT.net: claims "Totally Free" listings, but no
  self-serve submission form found — featured listings only via
  email/Twitter contact. Weak route; not submitted.
- Caveat for all three: they are built for UPCOMING drops and
  AURUM launched 19 Nov, so an already-live collection may not
  be accepted even when the forms work.
