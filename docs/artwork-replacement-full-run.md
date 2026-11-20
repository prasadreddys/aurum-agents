# AURUM AGENTS — Artwork Replacement Full Run

**Date:** 19 Nov 2026. **Status:** DEPLOYED + LIVE-VERIFIED — v3 artwork is
live on both preview and production (see §7.2). The sites now serve the new
cyberpunk artwork; the original artwork remains backed up, not live.
**Scope:** replace all 5,555 AURUM artworks with the user-approved cyberpunk
humanoid style (rain-soaked neon city, weathered armour, gold filigree,
glowing ring eyes, neon circuit chest panels). Supply stays 5,555; no
contract changes; no BNB spent; $0; no R2; no paid services. Original art
only — the iStock reference photo was never used as art.
**Rollback:** `artwork/backup-2026-11-19/` (original 5,555 images + 5,555
metadata + gallery-index + manifest, SHA256SUMS verified). The live
`artwork/images/` and `metadata/` were never touched during the run.

## 1. Bases used (24)

12 pilot bases + 12 full-run bases, all AI-generated in the approved style,
each verified by eye before use. Traits below are OBSERVED from the images,
not the prompts (epic-3 and legendary-4 came back Weathered White, not
Gold-Plated). Full-run bases came back 1728×1408 (landscape), normalised by
centre-cropping to square and resizing to 1600×1600 at load time.

| Base | Rarity | Eyes | Plating | Accessory | Background |
|---|---|---|---|---|---|
| common-1 | Common | Cyan Ring | Weathered White | None | Neon Rain — Blue |
| common-2 | Common | Cyan Ring | Titanium | None | Neon Rain — Blue |
| common-3 | Common | Cyan Ring | Gunmetal | Antenna | Neon Rain — Cyan |
| common-4 | Common | Cyan Ring | Obsidian | None | Neon Rain — Blue |
| common-5 | Common | Ice Blue Ring | Weathered White | Antenna | Neon Rain — Blue |
| common-6 | Common | Cyan Ring | Bronze | None | Neon Rain — Teal |
| uncommon-1 | Uncommon | Emerald Ring | Gunmetal | Back Panel | Neon Rain — Green |
| uncommon-2 | Uncommon | Emerald Ring | Bronze | Pauldron | Neon Rain — Green |
| uncommon-3 | Uncommon | Emerald Ring | Titanium | Shoulder Cannon | Neon Rain — Emerald |
| uncommon-4 | Uncommon | Emerald Ring | Obsidian | Holo Visor | Neon Rain — Emerald |
| uncommon-5 | Uncommon | Teal Ring | Titanium | Pauldron | Neon Rain — Teal |
| rare-1 | Rare | Violet Ring | Obsidian | Holo Visor | Neon Rain — Violet |
| rare-2 | Rare | Violet Ring | Weathered White | Back Panel | Neon Rain — Violet |
| rare-3 | Rare | Violet Ring | Bronze | Chest Emblem | Neon Rain — Violet |
| rare-4 | Rare | Violet Ring | Gunmetal | Crown | Neon Rain — Violet |
| rare-5 | Rare | Amber Ring | Obsidian | Chest Emblem | Neon Rain — Amber |
| epic-1 | Epic | Magenta Ring | Weathered White | Crown | Neon Rain — Magenta |
| epic-2 | Epic | Magenta Ring | Obsidian | Chest Emblem | Neon Rain — Magenta |
| epic-3 | Epic | Magenta Ring | Weathered White | Holo Visor | Neon Rain — Magenta |
| epic-4 | Epic | Rose Ring | Weathered White | Crown | Neon Rain — Pink |
| legendary-1 | Legendary | Gold Ring | Gold-Plated | Crown | Neon Rain — Gold |
| legendary-2 | Legendary | Gold Ring | Weathered White | Holo Visor | Neon Rain — Gold |
| legendary-3 | Legendary | Gold Ring | Obsidian | Crown | Neon Rain — Gold |
| legendary-4 | Legendary | Gold Ring | Weathered White | Holo Visor | Neon Rain — Gold |

Crowned bases (crown-safe framing): epic-1, rare-4, epic-4, legendary-1,
legendary-3.

## 2. Rarity assignment

Seeded shuffle exactly like the original `generate.py` (SEED_RARITY
20261118), so rarity-per-token matches the original collection:
Common 3,055 / Uncommon 1,389 / Rare 667 / Epic 333 / Legendary 111.
Aurum Gold edition = all 111 Legendary + 33 Epics (10%). Per-base usage
balanced within 1: Common 509/510, Uncommon 277/278, Rare 133/134,
Epic 83/84, Legendary 27/28.

## 3. Pipeline v2 — built, then FAILED validation

`artwork/variate2.py` (v2, seed 20261119): continuous framing (crop size
1024–1600, centre cx 700–900 / cy 480–780, rotation ±2.5°, flip 50%),
colour 0.85–1.15, brightness 0.90–1.10, contrast 0.92–1.12, tint alpha
0.03–0.09, rain 40–120, glow alpha 15–35, vignette 0.25, WebP quality 70
(method 4 — profiled 2.4× faster than method 6 at identical size),
2-worker parallel build. Full generation completed in ~54 min
(5,555 files, all SHA-256 unique, sizes 52,650–106,742 bytes, total
426.9 MB).

**Validation failure (the finding that drove v3).** The full 8×8
average-hash scan (`artwork/ahash_scan.py`, ~161 s, 1,027,799 within-base
pairs) found:

```
total pairs compared: 1027799
distance histogram (Hamming bits, within-base pairs):
  d= 0: 728
  d= 1: 1769
  d= 2: 3062
  d= 3: 4366
  d= 4: 5791
  d= 5: 7595
  d= 6: 9693
  d= 7: 11336
  d= 8: 13311
  d= 9: 15870
  d=10: 18271
  d=11: 21351
  d=12: 25653
  d>12: 889003
  pairs <= 4: 15716
```

Distinct tokens involved: d≤0: 747 · d≤1: 1,899 · d≤2: 2,963 ·
**d≤4: 4,469 tokens (80% of the collection)**. The histogram is a smooth
ramp with no natural threshold, and visual checks confirmed the problem
is real, not a metric artifact:

- d=0 pairs (#11~#1915, #21~#219, #74~#1317) — same robot, same framing,
  near-identical.
- d=2 (#1~#4524), d=3 (#5~#1784), d=4 (#5134~#5456), d=6 (#1~#439),
  d=10 (#1~#264) — all read as near-duplicates by eye.
- Even a d=12 pair (#1~#2022, near the bulk of the distribution) reads
  as the same robot in the same pose with only a ~10% zoom difference.

**Root cause (structural, not a bug):** the v2 framing window was too
narrow — every output was a medium bust shot of the same robot in the
same pose, so same-base pairs differ only by a slight reframe and grade.
With ~231 outputs per base, the framing space is saturated: a new token
has a ~97% chance of landing within d≤4 of some same-base token, so the
v2 regenerate-both loop could never converge. The v2 outputs were
discarded (never went live); the v2 manifest and gallery-index are
preserved as `artwork/manifest-v2-v2run.json` /
`artwork/gallery-index-v2-v2run.json`, and the full scan as
`artwork/ahash-report.txt` (15,762 lines).

## 4. Pipeline v3 — the fix

`artwork/variate2.py` (v3, seed 20261120). Changes vs v2:

- **Wide framing.** Non-crowned: size 700–1600, cx 500–1100, cy 350–950
  (tight face close-ups to full busts, off-centre). Crowned: size
  1250–1600, cx 650–950, cy 420–620 (crown stays in frame). Rotation
  ±4° with a centre crop scaled to the angle (7% at 4°).
- **Face-zone guard.** The crop must contain the whole face zone
  (x 650–1000, y 250–650, measured off the 24 bases — every face sits
  inside it, eyes at y 300–450, including the 3/4 profiles common-2 /
  epic-2 / rare-3 / uncommon-4). A point guard was NOT enough: v3 test
  token 48 (size 723, cy clamped to 811) still came back a neck-only
  shot because the face centre sat on the box edge; the zone guard
  fixed it (token 48 now a tight profile face shot, verified by eye).
- **Wider grades.** Colour 0.80–1.20, brightness 0.85–1.15, contrast
  0.90–1.15, tint alpha 0.03–0.12. New "Tight" framing label (<900px).
- **Rejection sampling (pool-based).** A flagged token is re-rolled
  until its hash is >4 bits from EVERY other output of its base
  (20 tries per pass, 5 passes, hashes cached per base as packed
  uint64s). Pool-based with 2 workers: a single-process loop would
  take ~2 h for the expected thousands of flagged tokens and the VM
  does not stay up that long. Manifest checkpointed after each
  250-token chunk; re-running the script resumes the build and the
  scan/regeneration from the current state.

**v3 evidence (all measured, not assumed):**

- 30-output wide-framing test on common-6 (`/tmp/test_wide_framing.py`,
  before the face-zone guard): pairs ≤4 fell 1.53% → **0.23%** (1 of
  435), 0 pairs ≤2; framing mix 8 Tight / 11 Close / 8 Wide / 3 Full;
  contact sheet showed genuinely varied, intact crops.
- The test's single d=3 pair (#9003~#9013) still read as a
  near-duplicate by eye — so the d≤4 threshold was kept (not loosened
  to d≤2).
- 48-token sandbox run of the full v3 script: built in 11.9 s
  (1.78 img/s), sizes 42,238–98,346 bytes, brightness mean 70.1,
  scan 0 flagged pairs, exit 0. Contact sheet (48 outputs across 18
  bases, incl. crowned epic-1/epic-4): varied, on-style, crowns
  intact, no broken crops.
- `reroll_one` unit test (`/tmp/test_reroll.py`): the known d=3 pair
  re-rolled to min-distance 22 (direct) and 13/22 (via a real
  mp.Pool) — worker logic and pickling verified.

## 5. Frontend trait labels

`GalleryToken` type (`frontend/src/data/rarity.ts`), `Gallery.tsx`
TRAIT_LABELS + card subtitle, and `MyNFTs.tsx:140` subtitle updated
from Armor/Helmet/Visor/Core to Plating/Eyes/Glow/Effect.
`useOwnedTokens.ts` only uses the GalleryToken type (no hardcoded keys).
Old-key grep clean. Lint 0 errors (1 pre-existing WalletModal warning,
same as Stage 7). Build exit 0 (36.84 s).

## 6. Validation (v3) — ALL PASS

- [x] **SHA-256 uniqueness:** 5,555 distinct file hashes, 0 duplicates
      (recomputed from the files, not trusted from the manifest).
- [x] **Size cap:** min 34,740 / max 108,092 bytes, total 370,020,720
      bytes (370.0 MB), 0 files over 500 KB.
- [x] **Standalone aHash scan** (`artwork/ahash-report-v3.txt`,
      `ahash_scan.py --threshold 4 --list`, 1,027,799 pairs):
      **0 flagged pairs at d≤4**; the histogram starts at d=5 (722
      pairs) — the minimum same-base distance in the whole collection
      is 5 bits. Pipeline's own final scan agreed (0 flagged, attempt 2
      of the cleanup run).
- [x] **Rarity / edition counts exact:** Common 3,055 / Uncommon 1,389 /
      Rare 667 / Epic 333 / Legendary 111; Aurum Gold 144 (111
      Legendary + 33 Epic); 24 distinct bases; framing mix Tight 1,509 /
      Close 2,472 / Wide 1,410 / Full 164.
- [x] **Metadata:** all 5,555 `metadata-v2/*.json` parse; every `name`
      is `AURUM AGENTS #<id>`.
- [x] **Brightness:** spot-check (first 200) mean 70.0, std 45.1.
- [x] **Visual spot-check, 30 random** (seeded `random.Random(20261119)`:
      51, 170, 225, 413, 452, 480, 1494, 1775, 1776, 1850, 1899, 2081,
      2252, 2319, 2455, 2707, 2966, 3635, 3941, 3986, 4156, 4232, 4520,
      4599, 4635, 4968, 4983, 4999, 5456, 5555): all distinct,
      on-style, faces intact, crowns intact on crowned ones, no broken
      crops, no near-duplicates visible.
- [x] **Visual spot-check, all 111 Legendary** (two contact sheets):
      all gold robots, every crown and holo visor fully in frame,
      every face present, framings and grades varied. One tight
      half-face crop (row 3 col 1 of sheet 2) is an intentional
      dramatic close-up, not a broken image (eye + visor in frame).

## 7. Swap + redeploy

- [x] **Swap done** (validation passed first): `artwork/images-orig/`,
      `metadata-orig/`, `artwork/gallery-index-orig.json`,
      `artwork/manifest-orig.json` hold the originals (plus the
      `backup-2026-11-19/` tarballs); `artwork/images/`,
      `metadata/`, `artwork/gallery-index.json`,
      `artwork/manifest.json` are now the v3 versions (5,555 each).
      `frontend/public/artwork/`, `public/metadata/`,
      `public/gallery-index.json` were cleaned before rebuilding so
      the size-based copy step could not leave a stale file.
- [x] **Frontend rebuilt:** `npm run build` exit 0 (17.68 s).
      `dist/artwork/` 5,555 files, `dist/metadata/` 5,555 files,
      `dist/gallery-index.json` 5,555 entries (111 Legendary).
      Spot-checked #1, #108, #1111, #5555: `dist/` artwork and
      metadata byte-match the new v3 sources and differ from the
      originals. Bundle fresh (`dist/index.html` references
      `index-BY5B1Mr_.js`, present in `dist/assets/`). Lint 0 errors,
      1 warning (pre-existing WalletModal warning, same as Stage 7).
- [x] **Preview deploy — DONE 19 Nov ~09:17 IST.** Deployment
      `e43dc883-da2f-468a-b67d-1c72e45b31d4`,
      https://e43dc883.aurum-agents-preview.pages.dev (production URL
      https://aurum-agents-preview.pages.dev). 11,113 uploaded /
      76 already present, 359.36 MiB, 5,555 substitutions, stage
      deploy / success, max 23 open fds.
- [x] **Production deploy — DONE 19 Nov ~09:19 IST.** Deployment
      `70db7668-8766-4993-b744-d7bd87dac6cc`,
      https://70db7668.aurumagents.pages.dev (production URL
      https://aurumagents.pages.dev). 11,189 uploaded, 362.18 MiB,
      5,555 substitutions, stage deploy / success, max 22 open fds.
- [x] **Live-verify both — DONE 19 Nov ~09:20 IST.** See §7.2 table;
      identical results on preview and production.

### 7.1 Deploy commands (run once `CLOUDFLARE_API_TOKEN` is available)

From `repo/frontend/`, with `NODE_USE_ENV_PROXY=1`:

```sh
# Preview first
NODE_USE_ENV_PROXY=1 \
CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" \
CLOUDFLARE_ACCOUNT_ID="b6dfc91e3ef1dcc4cfdb049448c2d969" \
node scripts/pages-direct-upload.mjs \
  --dir dist --project aurum-agents-preview --branch main \
  --substitute-base-uri https://aurum-agents-preview.pages.dev/artwork \
  --concurrency 3
# Live-verify preview (index 200, gallery-index parses with 5,555
# entries, artwork/metadata 1/1111/5555 all 200, CSP served, bundle
# matches, stats still CONTRACT NOT DEPLOYED), then:
# Production
NODE_USE_ENV_PROXY=1 \
CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" \
CLOUDFLARE_ACCOUNT_ID="b6dfc91e3ef1dcc4cfdb049448c2d969" \
node scripts/pages-direct-upload.mjs \
  --dir dist --project aurumagents --branch main \
  --substitute-base-uri https://aurumagents.pages.dev/artwork \
  --concurrency 3
# Live-verify production the same way, then record both deployment
# IDs / URLs / the live-check table here.
```

### 7.2 Deployment record (19 Nov 2026, ~09:15–09:20 IST)

The overnight blocker was the lost token: the original
"aurum-pages-preview" token lived only in a shell env var wiped by a VM
restart and was never recorded anywhere. On the user's return (09:10 IST)
they approved a fresh token; a browser task created **"aurum-pages-deploy"**
in their Chrome (Pages:Edit + Account:Read, same narrow scope) and reported
the value back. The value was written to a mode-600 temp file, read only
via `$(cat file)` into the deploy env var — never in a command line, chat,
file, or memory — and the temp file was deleted immediately after both
deploys. The token value remains unrecorded by design; if it is ever lost
again, the same fresh-token flow works.

Both deploys ran the §7.1 commands unchanged from `repo/frontend/` with
`NODE_USE_ENV_PROXY=1` and the same account ID. Live-check table (same
results on preview and production):

| Check | Result |
|---|---|
| index | 200, bundle `index-BY5B1Mr_.js` (new v3 bundle) |
| gallery-index.json | 5,555 entries; Common 3,055 / Uncommon 1,389 / Rare 667 / Epic 333 / Legendary 111 |
| artwork 1 / 1111 / 5555 | 200, sizes 46,900 / 51,824 / 67,756 B |
| metadata 1 / 1111 / 5555 | 200 |
| Served art = local v3 | SHA-256 identical for #1 and #5555 |
| metadata image field | `https://<site>/artwork/<id>.webp` (substituted per site) |
| CSP served | `default-src 'self'; img-src 'self' data:; ...` verbatim |
| Artwork cache | `public, max-age=31536000, immutable` |
| Contract state | `CONTRACT NOT DEPLOYED` present in the served bundle |

No BNB spent, nothing signed, nothing on-chain. The v3 artwork is now
live at https://aurumagents.pages.dev.

**Cache note (19 Nov ~09:26 IST):** the user reported the site still
showing the old gallery. Re-checked from the server: production still
serves v3 art (SHA-256 identical for #1 and #5555). The cause is browser
cache, not the deploy — the new artwork reuses the same URLs
(`/artwork/<id>.webp`) and those are served `public, max-age=31536000,
immutable`, so a browser that loaded the old gallery keeps the old images
without re-checking. Fix for returning visitors: hard refresh
(Ctrl+Shift+R in Chrome) or clear site data. Lesson for any future
artwork swap: either version the artwork URLs or expect stale art in
returning browsers until a hard refresh.

## 8. Build log (v3)

- v3 build launched 19 Nov 2026 ~22:05 IST (pid 5828, 2 workers),
  log `artwork/v3-build.log`. A VM restart killed it at 5,250/5,555
  (uptime 0 min on recovery); resumed and finished the remaining 305
  tokens in 89.4 s. Build rate ~5.26 img/s (faster than v2's ~2).
  Sizes at build end: min 35,008 / max 107,002, total 383.8 MB.
- Near-duplicate convergence (flagged pairs at d≤4): attempt 1:
  3,060 pairs (2,263 tokens, 902.6 s) → attempt 2: 374 pairs
  (500 tokens, 158.9 s) → attempt 3: 166 pairs (149 tokens, 96.8 s)
  → attempt 4: 24 pairs (38 tokens, 24.9 s) → attempt 5: 19 pairs
  (18 tokens, 11.8 s) → WARNING: 3 pairs remained
  `[(408, 4832, 2), (999, 1974, 3), (999, 2613, 3)]`.
- Cleanup re-run: 5/5 regenerated in 2.5 s; scan attempt 2:
  **0 flagged pairs**. Total script time 3,243.3 s (first run) +
  537.6 s (cleanup run). Final sizes: min 34,740 / max 108,092,
  total 370.1 MB.
