# AURUM AGENTS — Deployment Runbook (Stage 8)

**Date:** 2026-11-19 (IST)
**Project:** Cloudflare Pages project `aurumagents`
**Production URL (current):** https://aurumagents.pages.dev/
**Preview project:** `aurum-agents-preview`
(https://aurum-agents-preview.pages.dev/) — the same full site
deployed there first (deployment `2d5a0110`); it stays live as-is
as the staging/preview project. Do not delete it.
**Status:** Prepared by Worker 2 (CSP decision + runbooks). This is a
runbook, not a deploy log — it describes how to deploy, verify, roll
back, and rotate the token. It deploys nothing
by itself.

**Hard rules (standing):** Cloudflare free tier only, $0. Do NOT
activate R2. No custom domain is needed — the production URL stays
the *.pages.dev URL (blocker B2 closed 19 Nov 2026, per the owner's
word). Do NOT deploy from this document alone — deployment is
the coordinator's step, after the Stage 8 config work (Worker 1) lands.

## 0. What is deployed

- The Vite production build in `repo/frontend/dist/` — app shell
  (`index.html`, `assets/*`, `favicon.svg`), plus the full collection
  data served statically from the same Pages project:
  - `/gallery-index.json` — the 5,555-token gallery index.
  - `/artwork/<id>.webp` — 5,555 artwork files (768×768 WebP).
  - `/metadata/<id>.json` — 5,555 metadata files. The repo source
    keeps the `image` field as the `{BASE_URI}/<id>.webp` placeholder;
    the deploy script substitutes it at upload time to
    `https://aurumagents.pages.dev/artwork/<id>.webp`
    (see §3), so the deployed files are correct. The contract's
    `baseURI` (Stage 9) will separately be
    `https://aurumagents.pages.dev/metadata/`.
  - `/_headers` — security headers incl. the Content-Security-Policy
    (see §6).
- `dist/` is produced by `npm run build` in `repo/frontend/`. Its
  `prebuild` step runs `scripts/copy-assets.mjs`, which copies
  `repo/artwork/images/*.webp` → `public/artwork/`,
  `repo/artwork/gallery-index.json` → `public/gallery-index.json`, and
  `repo/metadata/*.json` → `public/metadata/` (idempotent: copies only
  missing or size-changed files). `public/` is build output — the
  single source of truth stays in `repo/artwork/` and `repo/metadata/`.
- The local `dist/` holds **11,190 files** (counted 19 Nov 2026).
  The Stage 8 full deploy (deployment
  `2d5a0110-e33b-42be-a71c-7ac89c890dfa`) carried **11,189 manifest
  entries** (`_headers` attached separately) — see
  `docs/stage8-report.md` §4 for the count and how it was verified.
- Earlier preview deploys (Stages 5–6) were app-shell-only (77 files);
  artwork/metadata were left out because of a VM file-descriptor
  limit on the 11,188-file upload. Stage 8 is the first full deploy
  (see `docs/stage5-report.md` / `docs/stage6-report.md`).

## 1. Prerequisites

- A clean production build: `cd repo/frontend && npm run build`
  (exit 0; runs `tsc -b` first, then Vite). Rebuild after any change
  to source, `_headers`, or `wrangler.toml`.
- Deploy credentials as **environment variables only** (never in a
  file, never committed, never printed):
  - `CLOUDFLARE_API_TOKEN` — the deploy token (see §5).
  - `CLOUDFLARE_ACCOUNT_ID` — the Cloudflare account that owns the
    `aurumagents` project.
- The token needed is the existing one named `aurum-pages-preview`
  (Pages:Edit + Account:Read, no expiry). Stage 7 verified by grep
  that no token value appears anywhere in the repo or the built
  bundle — keep it that way.

## 2. Build

```sh
cd repo/frontend
npm run build        # prebuild copies artwork + metadata into public/, then tsc + vite build
```

Expected: exit 0. `dist/` must contain `_headers`, `artwork/`
(5,555 files), `assets/`, `favicon.svg`, `gallery-index.json`,
`index.html`, `metadata/` (5,555 files). If `dist/` is missing the
artwork/metadata trees, the `prebuild` copy step did not run — do not
deploy a partial `dist/`; fix the copy step first.

## 3. Deploy — direct upload script

The deploy path is `repo/frontend/scripts/pages-direct-upload.mjs`
(Stage 8, written because `wrangler pages deploy` dies with EMFILE on
this VM — fd hard limit 4096 — once the site holds 11,188 files). It
talks to the Pages REST API directly, with no wrangler involvement:

- takes `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` via
  environment variables (§1) — the token is never printed or written
  anywhere by the script;
- walks `dist/`, hashes every file with
  `blake3(base64(bytes) + extension)` (first 32 hex chars — the same
  hash wrangler uses, so assets wrangler already uploaded are recognised
  as present and skipped);
- reads files **strictly one at a time** (a single open fd during
  hashing) and uploads pre-read in-memory buffers with bounded
  concurrency (default 3), batched to ≤40 MiB / ≤2,000 files per
  request — peak open fds observed on the Stage 8 full deploy: **22**
  (limit 4096);
- `GET .../upload-token` for a JWT, `POST /pages/assets/check-missing`
  to find what is missing, `POST /pages/assets/upload` per batch
  (5 attempts, exponential backoff; JWT refreshed on 401), then
  `POST .../deployments` (multipart: `manifest` JSON `{"/path": hash}`
  + `_headers` file part + `branch=main`) and polls the deployment
  until `latest_stage` is `deploy` / `success` (10-minute timeout);
- `_headers` / `_redirects` / `_routes.json` are special files:
  excluded from the manifest and attached to the deployment create
  call instead;
- `--substitute-base-uri <url>` replaces the literal `{BASE_URI}`
  placeholder inside `metadata/*.json` **at upload time only** (repo
  sources keep the placeholder). The contract's baseURI (Stage 9)
  will be `<site>/metadata/`; the metadata `image` field must point
  at the artwork base, so the value passed is
  `https://aurumagents.pages.dev/artwork`.

Exact invocation (from `repo/frontend/`, token via env var):

```sh
NODE_USE_ENV_PROXY=1 \
CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" \
CLOUDFLARE_ACCOUNT_ID="b6dfc91e3ef1dcc4cfdb049448c2d969" \
node scripts/pages-direct-upload.mjs \
  --dir dist --project aurumagents --branch main \
  --substitute-base-uri https://aurumagents.pages.dev/artwork \
  --concurrency 3
```

(`NODE_USE_ENV_PROXY=1` is required — this VM reaches the internet
through an egress proxy and Node's fetch only honours `HTTPS_PROXY`
with that flag.)

Flags: `--dir` (required), `--project` (default
`aurumagents`), `--branch` (default `main`),
`--substitute-base-uri` (optional, see above), `--concurrency`
(default 3), `--dry-run` (hash + check-missing only; uploads and
creates nothing — use it to preview what a deploy would do).

Reporting: the script prints progress lines and a final JSON summary
(filesTotal, manifestEntries, alreadyPresent, uploaded, uploadMiB,
substitutions, deploymentId, deploymentUrl, productionUrl,
maxOpenFds) and exits 0 only on `deploy` / `success`. A failed batch
aborts the run (after its 5 retries) — nothing is half-deployed: the
deployment is only created after every batch succeeds, and a failed
run leaves the previous production deployment untouched. Re-running
is safe: check-missing skips everything already uploaded.

`wrangler.toml` (`repo/frontend/wrangler.toml`) pins the production
setup: `name = "aurumagents"`,
`pages_build_output_dir = "./dist"`. It is a record, not a trigger:
for direct-upload projects wrangler has no build-command or
production-branch field (those exist only for git-connected builds);
build command (`npm run build`, in `repo/frontend/`) and production
branch (`main`) are recorded there as comments, with the production
env vars documented (`VITE_WC_PROJECT_ID` from `.env`,
`VITE_CONTRACT_ADDRESS` empty until Stage 9, `VITE_BSC_RPC_URL` /
`VITE_BSC_RPC_FALLBACK_URL`).

## 4. Verify a deployment

Run these against the production URL after every deploy. All must
return HTTP 200. (`curl -s -o /dev/null -w "%{http_code}" <url>`.)

| Check | URL | Expect |
|---|---|---|
| Index / app shell | `https://aurumagents.pages.dev/` | 200, HTML |
| Gallery index | `https://aurumagents.pages.dev/gallery-index.json` | 200, JSON |
| Artwork sample | `https://aurumagents.pages.dev/artwork/1.webp` | 200, `image/webp` |
| Metadata sample | `https://aurumagents.pages.dev/metadata/1.json` | 200, JSON |
| Headers applied | `curl -sI https://aurumagents.pages.dev/ \| grep -i content-security-policy` and `curl -sI …/artwork/1.webp \| grep -i cache-control` | CSP present (see §6); artwork/metadata `Cache-Control: public, max-age=31536000, immutable` |
| Bundle freshness | `grep -o 'index-[A-Za-z0-9_-]*\.js' dist/index.html` matches the `assets/index-*.js` served | Served bundle = built bundle |

Notes:

- `/_headers` is **not** fetchable as a file: Pages consumes it as
  configuration and the SPA fallback serves `index.html` for that
  path (verified 19 Nov 2026 — `GET /_headers` returns the app
  shell, HTTP 200). The headers themselves are verified via the
  response headers on the real assets (the "Headers applied" row
  above), not by fetching `/_headers`.
- `vite preview` does **not** apply `_headers` (Stage 7 §3.2) — a
  missing CSP header in local preview proves nothing. The CSP check
  above is meaningful only against Pages.
- Spot-check more than one artwork/metadata ID (e.g. `1`, `5555`)
  on a full deploy; a single 200 does not prove all 11,110 files
  uploaded. The deployment's file count (from the deploy output or
  the dashboard Deployments tab) is the real completeness check —
  record it in `docs/stage8-report.md` §4.
- If any check fails, do not "fix" it by editing the live site.
  Roll back (§4.1 below) or redeploy a corrected build.

### 4.1 Roll back

Cloudflare keeps prior deployments; a rollback re-points production
at an older deployment without re-uploading anything.

1. Dashboard → **Workers & Pages** → select `aurumagents`
   → **Deployments**.
2. Find the previous production deployment (the one before the bad
   one — note its deployment ID / timestamp).
3. Open its menu (⋯) → **Rollback** (wording: "Rollback to this
   deployment" / "Rollback").
4. Confirm. Production traffic serves the older deployment.
5. Re-run the §4 checks against the production URL.
6. Record the rollback (which deployment, why) in
   `docs/stage8-report.md` §4.

There is no code change involved in a rollback and no BNB at stake
(the site is static; the contract is not deployed yet). A rollback
does not delete the bad deployment — it stays listed and can be
re-deployed or inspected.

## 5. Rotate / revoke the deploy token

Token: **`aurum-pages-preview`** — permissions Pages:Edit +
Account:Read, no expiry (per project memory; value never recorded
anywhere, including this repo).

- **Where:** Cloudflare dashboard → **My Profile → API Tokens**
  (`https://dash.cloudflare.com/profile/api-tokens`).
- **Rotate** (recommended over revoke-and-recreate when a deploy is
  imminent):
  1. Create a new custom token with the same permissions
     (Account → Cloudflare Pages → Edit; Account → Account → Read)
     and the same account scope; name it `aurum-pages-preview`
     (or `aurum-pages-preview-2` while both exist).
  2. Export it as `CLOUDFLARE_API_TOKEN` in the deploy environment
     and run one deploy (§3–§4) to prove the new token works.
  3. Only then revoke the old token (API Tokens → ⋯ → Revoke/Delete).
- **Revoke:** API Tokens → find `aurum-pages-preview` → Revoke.
  Revocation is immediate: any deploy attempted afterwards with the
  old token fails authentication. Revoking does **not** take the live
  site down — it only blocks future API deploys until a new token is
  configured.
- **If a token value leaks** (pasted into chat, a file, a log):
  revoke it immediately, create a replacement, and re-check the repo
  with the Stage 7 secrets grep (no `cfat_`/`cfut_`/
  `CLOUDFLARE_API_TOKEN` strings anywhere, including `dist/`).
- Never store the token in `frontend/.env` (that file holds only
  public client-side values: Reown project ID, contract address, RPC
  URLs). Never print it in a report.

## 6. Content-Security-Policy decision (summary)

**Verdict: NO CSP change is needed for the Pages-static deployment.**
Full evidence in `docs/stage8-report.md` §1.

- `fetch(tokenURI)` (`src/hooks/useOwnedTokens.ts:88`) goes
  **same-origin** once the contract baseURI is the Pages URL
  (`https://aurumagents.pages.dev/metadata/`), because
  tokenURI is baseURI + `<id>.json` — so `connect-src 'self'`
  already covers it.
- Gallery artwork (`src/components/Gallery.tsx`, `/artwork/<id>.webp`)
  and My NFTs artwork (`src/components/MyNFTs.tsx`, same path) are
  same-origin `<img>` loads — `img-src 'self'` covers them. The
  on-chain metadata `image` field is parsed but **never rendered**
  (Stage 7 §2.3), so it creates no `img-src` exposure today.
- The current CSP in `frontend/public/_headers` — `connect-src
  'self' https://bsc-rpc.publicnode.com https://bsc-dataseed.bnbchain.org
  wss://relay.walletconnect.com https://relay.walletconnect.com`,
  `img-src 'self' data:` — already covers every origin the app
  touches (RPC hosts per `src/config/env.ts`, WalletConnect relay,
  Google Fonts via `style-src`/`font-src`).
- A CSP entry becomes necessary **only if metadata/artwork move to a
  different host** (e.g. an R2 public bucket domain, an IPFS gateway,
  another CDN). Then add that host to `connect-src` (for
  `fetch(tokenURI)`) and to `img-src` only if images from that host
  are rendered. No custom domain is planned (B2 closed 19 Nov 2026),
  so there is no custom-domain case to cover — the standing rule is
  simply that the contract baseURI host must match the site host.

## 7. Known limits / open items

- Deploy path is now fully documented (§3): the upload script and
  `wrangler.toml` both exist (Stage 8). The Stage 8 full deploy
  (deployment `2d5a0110-e33b-42be-a71c-7ac89c890dfa`) is the first
  production deployment with all 11,190 files.
- `npm audit` is blocked by the sandbox egress proxy (Stage 7 §2.1)
  — run it from another environment before mainnet (Stage 9 item).
- Auxiliary WalletConnect hosts (`verify.walletconnect.com`,
  `explorer-api.walletconnect.com`, `api.web3modal.org`) are
  unconfirmed against the CSP (Stage 7 §2.4) — a live WalletConnect
  end-to-end test should confirm no CSP block; add narrowly only if
  one appears.
- Free-tier `eth_getLogs` flakiness (Stage 6): the activity feed
  degrades honestly, but on mainnet history will sometimes show
  "unavailable". A dedicated/paid RPC is a Stage 8/9 owner decision,
  not a code fix.

## Sources

- Code read 19 Nov 2026: `frontend/public/_headers`,
  `frontend/src/config/env.ts`,
  `frontend/src/hooks/useOwnedTokens.ts`,
  `frontend/src/components/Gallery.tsx`,
  `frontend/src/components/MyNFTs.tsx`,
  `frontend/scripts/copy-assets.mjs`, `frontend/index.html`,
  `frontend/package.json`, `repo/metadata/1.json`.
- Reports: `docs/stage5-report.md`, `docs/stage6-report.md`,
  `docs/stage7-report.md` (§2.3, §2.4, §4).
- Project memory: token name `aurum-pages-preview` (Pages:Edit +
  Account:Read, no expiry); production URL
  `https://aurumagents.pages.dev/` (project `aurumagents`, id
  `917be932-e7a8-4469-ac0c-e27c55c0bced`); preview project
  `aurum-agents-preview`, `https://aurum-agents-preview.pages.dev/`
  (full site deployed there first, deployment `2d5a0110`, still
  live as-is).
