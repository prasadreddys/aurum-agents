# AURUM AGENTS — Brand Identity

**Brand name:** AURUM AGENTS
**Tagline:** *Forged in gold. Owned on-chain.*
**Collection:** 5,555 ERC-721 NFTs on BNB Smart Chain Mainnet (chain 56)
**Supply split:** 1,111 free (1 per wallet) + 4,444 paid at 0.001 BNB (max 10 per wallet, 11 combined)
**Status:** Contract not deployed. No artwork is minted yet; all artwork and metadata in this repo are pre-mint assets awaiting the approved mainnet deployment (Stage 9).

> "Aurum" is Latin for gold. The brand pairs the permanence of gold with the
> precision of autonomous AI agents — futuristic robot agents rendered in black
> and gold, each one unique, each one verifiably scarce.

## 1. Colour palette

Black-and-gold, Binance-inspired. Dark backgrounds, gold as the only warm
accent; cool cyans/violets appear only as visor/core glow, never as competing
brand colours.

| Token | Hex | Usage |
|---|---|---|
| Aurum Black | `#050505` | Page background, deepest layer |
| Obsidian | `#0B0B0F` | Panel background |
| Gunmetal | `#14161C` | Panel borders, secondary surfaces |
| Steel | `#2A2E35` | Muted text, dividers |
| Aurum Gold | `#FFD700` | Primary accent, Legendary glow, CTAs |
| Antique Gold | `#D4AF37` | Secondary gold, gradients, borders |
| Bright Gold | `#F5C518` | Highlights, hover states |
| Deep Gold | `#B8860B` | Shadows, pressed states, dark gold |
| Bone White | `#F5F1E6` | Primary text on black |
| Muted Grey | `#9A9AA3` | Secondary text |
| Visor Cyan | `#35E0FF` | Common-tier visor/core glow |
| Visor Emerald | `#2EEA8A` | Uncommon-tier visor/core glow |
| Visor Violet | `#A855F7` | Rare-tier visor/core glow |
| Visor Magenta | `#FF5C8A` | Epic-tier visor/core glow |

**Gradient rule:** gold gradients always run Bright Gold → Aurum Gold →
Antique Gold → Deep Gold, top to bottom. Never use flat yellow (`#FFFF00`).
Never place gold text on a gold background.

## 2. Typography

| Role | Font | Stack / source |
|---|---|---|
| Display / headings | **Space Grotesk** | Google Fonts (free, OFL); fallback `system-ui, sans-serif` |
| Body / UI | **Inter** | Google Fonts (free, OFL); fallback `system-ui, sans-serif` |
| Mono (addresses, hashes, token IDs) | **JetBrains Mono** | Google Fonts (free, OFL); fallback `ui-monospace, monospace` |

- Display headings: uppercase, tight letter-spacing (`-0.02em`), weight 700.
- Numbers/stats: tabular figures, JetBrains Mono for on-chain values.
- Never use more than three typefaces on one page.

## 3. Visual direction

- **Premium futuristic Web3 aesthetic.** Dark void backgrounds, gold light,
  glassmorphism panels (`rgba(255,255,255,0.04)` fill, 1px gold-tinted
  border, backdrop blur), soft gold glows, fine grid/circuit textures.
- **3D-feel without 3D assets:** layered gradients, radial glows, drop
  shadows and parallax on hover give depth; no paid 3D models or stock art.
- **Motion:** slow float on the hero character, drifting gold particles
  (canvas), shimmer sweep on gold text, restrained hover lifts
  (`translateY(-2px)`). No auto-playing video, no flashing.
- **Imagery:** every NFT is a generative robot/agent portrait — symmetric,
  centred, bust-style, helmet + visor + armoured torso, on a dark
  gradient background with stars/circuit texture. No photographs, no
  copied characters, no logos of other brands.
- **Icons:** inline SVG only (no icon font, no paid icon set).

## 4. Rarity tiers

Five tiers. Distribution is fixed across the 5,555-token collection and is
assigned deterministically (seeded shuffle) so rarity is not correlated with
token ID or mint order.

| Tier | Count | Share | Visor / core glow | Gold treatment | Frame |
|---|---|---|---|---|---|
| Common | 3,055 | 55.0% | Cyan `#35E0FF` | Gold trim only | Thin steel frame |
| Uncommon | 1,389 | 25.0% | Emerald `#2EEA8A` | Gold trim + gold chest emblem | Steel frame, gold corners |
| Rare | 667 | 12.0% | Violet `#A855F7` | Gold pauldrons + emblem | Gold corner ornaments |
| Epic | 333 | 6.0% | Magenta `#FF5C8A` | Gold armour plates + glow halo | Gold frame, halo glow |
| Legendary | 111 | 2.0% | Gold `#FFD700` | Full gold armour + crown + halo | Full gold frame, radiant halo |

**Edition trait:** `Aurum Gold` edition = all 111 Legendary + 33 Epic
(10% of Epic, seeded). Total gold editions: 144. All other tokens are
`Standard` edition.

Rarity is a metadata attribute only. It does not change mint price, mint
limits, or any contract behaviour.

## 5. Trait system

Each token carries these attributes (see `metadata/`):

| Attribute | Values |
|---|---|
| Rarity | Common / Uncommon / Rare / Epic / Legendary |
| Background | Void Black, Nebula Gold, Circuit Grid, Starfield, Aurum Haze, Deep Space |
| Armor | Gunmetal, Obsidian, Titanium, Bronze, Gold-Plated |
| Helmet | Dome, Angular, Horned, Crowned, Sentinel, Vanguard |
| Visor | Cyan, Emerald, Violet, Magenta, Gold |
| Accessory | None, Antenna, Pauldrons, Chest Emblem, Back Panel, Shoulder Cannon |
| Core | Circle, Diamond, Hexagon, Triangle |
| Edition | Standard, Aurum Gold |

Trait values are drawn from a seeded generator (`artwork/generate.py`);
identical seeds always produce identical artwork and metadata.

## 6. Voice

- Short, confident, factual. No hype words ("moon", "gem", "100x").
- Never claim a mint, sale, or deployment that has not happened on-chain.
- Statuses are always one of: a real on-chain value, `CONTRACT NOT DEPLOYED`,
  `CONNECT WALLET`, or `DATA UNAVAILABLE`.

## 7. Logo

Wordmark only: **AURUM AGENTS** in Space Grotesk 700, uppercase, with
"AURUM" in Aurum Gold and "AGENTS" in Bone White, followed by a small gold
diamond (◆) mark. No image logo file is required; the wordmark is rendered
in CSS/SVG wherever it appears.

## 8. Files

- Brand doc: `docs/brand.md` (this file)
- Artwork generator: `artwork/generate.py` (seeded, deterministic)
- Artwork: `artwork/images/<tokenId>.webp` (5,555 files, ≤500 KB each)
- Trait manifest: `artwork/manifest.json`
- Metadata: `metadata/<tokenId>.json` (5,555 files, OpenSea-compatible)
- Website: `frontend/` (Vite + React 19 + TypeScript + Tailwind v4)
