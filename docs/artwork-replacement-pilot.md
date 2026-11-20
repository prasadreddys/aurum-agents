# AURUM AGENTS — Artwork Replacement PILOT Report

**Date:** 19 Nov 2026 (~01:30–02:00 IST)
**Status:** PILOT COMPLETE. Nothing live was changed.
**Scope:** pilot only — 24 images + metadata. The live artwork
(`artwork/images/`, `metadata/`, gallery index) was NOT overwritten,
the contract was NOT touched, nothing was redeployed, supply stays 5,555.

## 1. Backup (done first, verified)

`repo/artwork/backup-2026-11-19/` — 71 MB total, checksums in `SHA256SUMS`:

| Item | Count | SHA-256 (first 12) |
|---|---|---|
| `images.tar.gz` (all of `artwork/images/`) | 5,555 `.webp` | `632eacfff740` |
| `metadata.tar.gz` (all of `metadata/*.json`) | 5,555 `.json` | `b14e1bcfa925` |
| `gallery-index.json` (copy) | 5,555 entries | `3d3f92e6b998` |
| `manifest.json` (copy) | 5,555 entries | `13627d3f2f0e` |

Counts verified by listing tarball contents and parsing the JSON.
Rollback = extract these two tarballs + copy the two JSON files back.

## 2. Method — AI bases + deterministic variation

AI image generation cannot produce 5,555 unique images one by one
(4 calls per response, ~1 min each). The honest approach:

1. **Generate a small set of AI base robots** in the approved cyberpunk
   style (rain-soaked neon city, weathered armour, gold filigree,
   glowing ring eyes, neon circuit chest panels), covering the rarity
   axes: eye colour, plating, accessory, background.
2. **Deterministic PIL variation pipeline** (`artwork/pilot/variate.py`,
   fixed seed `20261119`) that turns each base into many unique outputs:
   framing crop (full / tight / head) × horizontal flip × colour grade
   (colour/brightness/contrast jitter) × warm/cool tint wash × seeded
   rain-streak overlay × rarity-colour chest glow × vignette.
   Re-running the script reproduces byte-identical files.

### Bases — 12 produced, all verified by eye

| Base | Rarity | Eyes | Plating | Accessory | Background |
|---|---|---|---|---|---|
| common-1 | Common | Cyan Ring | Weathered White | None | Neon Rain — Blue |
| common-2 | Common | Cyan Ring | Titanium | None | Neon Rain — Blue |
| common-3 | Common | Cyan Ring | Gunmetal | Antenna | Neon Rain — Cyan |
| uncommon-2 | Uncommon | Emerald Ring | Bronze | Pauldron | Neon Rain — Green |
| uncommon-3 | Uncommon | Emerald Ring | Titanium | Shoulder Cannon | Neon Rain — Emerald |
| rare-1 | Rare | Violet Ring | Obsidian | Holo Visor | Neon Rain — Violet |
| rare-2 | Rare | Violet Ring | Weathered White | Back Panel | Neon Rain — Violet |
| rare-3 | Rare | Violet Ring | Bronze | Chest Emblem | Neon Rain — Violet |
| epic-1 | Epic | Magenta Ring | White + filigree | Crown | Neon Rain — Magenta |
| epic-2 | Epic | Magenta Ring | Obsidian | Chest Emblem | Neon Rain — Magenta |
| legendary-1 | Legendary | Gold Ring | Gold-Plated | Crown | Neon Rain — Gold |
| legendary-2 | Legendary | Gold Ring | Weathered White | Holo Visor | Neon Rain — Gold |

All 12 are 1600×1600 WebP, on-style, distinct from each other
(different faces, poses, accessories, palettes). All 12 were looked at
before use. One failure: the first Uncommon base (`uncommon-1`,
emerald/gunmetal/antenna) errored in the generation worker and its file
never landed on disk; it was NOT retried, and the slot was covered by
the differently-designed `uncommon-2` instead.

Reference style image: `artwork/samples/media-generation-aurum-other-style-1-0-b0732397-6651-413f-9123-7b1f3126d959.webp`
(the cyberpunk portrait the user approved 19 Nov). The iStock photo
itself was never used as art — original generations only.

## 3. Pilot batch — 24 tokens

`artwork/pilot/images/1.webp` … `24.webp` (768×768 WebP, quality 82),
`artwork/pilot/metadata/1.json` … `24.json`,
`artwork/pilot/pilot-gallery-index.json`,
`artwork/pilot/pilot-manifest.json` (per-token base, variation params,
SHA-256, size).

- **12 bases × 2 variations each.** Tokens 1–6 Common, 7–10 Uncommon,
  11–16 Rare, 17–20 Epic, 21–24 Legendary — all 5 rarities covered.
  (Pilot uses 2-per-base for coverage; the full run uses the real
  proportional distribution — see §5.)
- **SHA-256: all 24 unique** (asserted in the script), and none equals
  any base hash.
- **Sizes:** min 82,452 B, max 133,382 B, total 2,619,726 B (avg ~109 KB).
- **Metadata:** same schema as `metadata/*.json` (name, description,
  `{BASE_URI}/<id>.webp`, attributes). Trait names adapted to the new
  style: Rarity, Edition, Background, **Plating** (was Armor),
  **Eyes** (was Visor), Accessory, **Glow**, **Effect** (Light/Heavy
  Rain). Edition: Legendary = Aurum Gold, all others Standard
  (pilot has 4 Epics, so no Epic Gold — the full run gives 10% of
  Epics the Gold edition, i.e. 33, as in the original system).
- **Programmatic check:** all 24 are 768×768, mean brightness 46–87,
  std 35–57, full 0–255 range — none blank, none broken. All 24
  metadata JSONs parse; gallery-index and manifest each hold 24.

### Visual verification — all 24 looked at

Every pilot image was read and inspected. All are genuinely cyberpunk
(rain, neon city, glowing ring eyes, circuit chest panels), none is
broken or blank, and outputs from different bases are clearly distinct.

**Weakness found (honest):** same-base pairs that rolled the SAME crop
are near-duplicates. #3/#4 (common-2, both head-crop, both flipped),
#5/#6 (common-3, both tight, both unflipped) and #11/#12 (rare-1, both
tight) differ only in colour grade and rain density — side by side they
read as the same picture. Flip only helps when the base is asymmetric
(#7/#8: the pauldron visibly swaps shoulders; #1/#2: background signs
swap sides). Pairs with different crops are clearly distinct
(#13 head vs #14 full; #17 tight vs #18 full; #21 head vs #22 full).
**Full-run fix (required):** force the variations of one base to use
different crops, add a zoom/scale axis, and widen the grade ranges.

Minor notes: the "tight" crop clips the top of tall crowns (#24 —
crown cut at the frame edge, still looks fine). AI background neon
signs contain gibberish pseudo-text (present in the bases too) —
background-only, never on the robot.

## 4. Size finding — the full run will be ~9× heavier

Pilot outputs average ~109 KB vs ~12 KB for the current programmatic
artwork (67 MB total). At the same quality, 5,555 new images ≈
**~610 MB** of artwork (vs 67 MB now). Pages accepts it (5,555 files
is well under the per-deployment file cap; each file is far under the
25 MB file cap), but the upload takes proportionally longer
(Stage 8 moved 76 MB in ~92 s → ~610 MB ≈ 12 min) and the site
payload grows. Mitigations for the full run: drop WebP quality
82 → ~70 (roughly halves photographic file sizes with little visible
loss at gallery scale) and/or keep 768 px (already the size). Decide
before the full run; the pilot used 82 to match the original setting.

## 5. Full-run plan (for approval)

1. **Bases: 12 → 24.** Generate 12 more bases (4 calls per response,
   ~3 more responses, ~25 min wall) so each base is used ~230× instead
   of ~460×. Reuse the 12 pilot bases.
2. **Pipeline v2 (~30 min):** enforce distinct (crop, flip) per base
   set; add a zoom axis (1.0× / 1.15×); widen grade ranges;
   crown-safe crops (exclude crowned bases from the tight/head crops
   or shift the crop window down); keep the seed deterministic.
   Decide WebP quality (82 vs ~70) from the §4 size finding.
3. **Rarity assignment:** seeded shuffle exactly like the original
   `generate.py` — Common 3,055 / Uncommon 1,389 / Rare 667 / Epic 333
   / Legendary 111; Aurum Gold = all Legendary + 33 Epics (10%).
4. **Full generation (~90 min compute):** pilot ran at ~0.95 s/image
   (22.7 s for 24) → 5,555 ≈ 88 min, run backgrounded. Outputs to a
   NEW `artwork/images-v2/` + `metadata-v2/` (never overwrite in place
   until validated).
5. **Validation (~20 min):** SHA-256 uniqueness across all 5,555,
   size cap check (≤500 KB each), programmatic blank/broken scan,
   visual spot-check of ~30 random outputs + all Legendary.
6. **Frontend trait labels (~15 min):** `Gallery.tsx` /
   `useOwnedTokens.ts` currently display the old trait keys
   (Armor/Helmet/Visor/Core). Update to the new names
   (Plating/Eyes/Glow/Effect) or the gallery shows stale labels.
7. **Swap + redeploy (~30 min):** move `images-v2/` → `images/`,
   `metadata-v2/` → `metadata/`, regenerate `gallery-index.json` +
   `manifest.json`; rebuild frontend (`copy-assets.mjs`); redeploy to
   the `aurumagents` Pages project with the existing direct-upload
   script (`--substitute-base-uri https://aurumagents.pages.dev/artwork`);
   live-verify index/gallery/artwork/metadata + CONTRACT NOT DEPLOYED
   states. Rollback = the §1 backup.
8. **No contract changes, no supply change, no redeploy of the
   contract, no BNB, $0.**

**Time estimate for the full run: ~3–4 hours of agent work across
several turns** (bases ~25 min, pipeline v2 ~30 min, generation ~90 min
backgrounded, validation + frontend + swap/redeploy ~60–90 min).
It cannot be done in a single turn — the base generation alone is
capped at 4 calls per response.

## 6. What was NOT done

No file under `artwork/images/`, `metadata/`, or the live site was
modified. No contract change. No redeploy. No supply change.
Pilot IDs 1–24 are pilot numbering, not token IDs.
