import Particles from "./Particles";
import { FEATURED_TOKEN_ID, FEATURED_RARITY } from "../data/featured";
import { FREE_SUPPLY, PAID_PRICE_BNB, TOTAL_SUPPLY } from "../data/rarity";
import { CONTRACT_DEPLOYED } from "../config/contract";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-320px] h-[640px] w-[900px] -translate-x-1/2 rounded-full bg-aurum-gold/10 blur-[140px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(212,175,55,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(212,175,55,0.05)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_35%,black,transparent)]" />
      </div>
      <Particles density={80} />

      <div className="relative mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:pt-24">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-antique-gold/40 bg-antique-gold/10 px-3 py-1 font-mono text-[11px] tracking-[0.18em] text-bright-gold uppercase">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-aurum-gold animate-glow-pulse" />
            BNB Smart Chain Mainnet · Chain 56
          </p>
          <h1 className="font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-7xl">
            <span className="text-gold-shimmer">Aurum</span>
            <br />
            Agents
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-grey">
            5,555 autonomous agents, forged in gold. Each one a unique
            generative robot — cybernetic armour, glowing visor, its own
            rarity. Owned on-chain, minted on BNB Smart Chain.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#mint"
              className="btn-gold rounded-xl px-6 py-3.5 text-sm font-bold uppercase tracking-wide"
            >
              Mint now
            </a>
            <a
              href="#gallery"
              className="btn-ghost rounded-xl px-6 py-3.5 text-sm font-semibold uppercase tracking-wide"
            >
              Explore collection
            </a>
            <a
              href="https://x.com/AurumAgents"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost rounded-xl px-6 py-3.5 text-sm font-semibold uppercase tracking-wide"
            >
              Follow on X — @AurumAgents
            </a>
          </div>

          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4">
            <div className="glass rounded-2xl p-4">
              <dt className="font-mono text-[11px] uppercase tracking-widest text-muted-grey">
                Total supply
              </dt>
              <dd className="mt-1 font-display text-2xl font-bold text-bone">
                {TOTAL_SUPPLY.toLocaleString()}
              </dd>
            </div>
            <div className="glass rounded-2xl p-4">
              <dt className="font-mono text-[11px] uppercase tracking-widest text-muted-grey">
                Free mint
              </dt>
              <dd className="mt-1 font-display text-2xl font-bold text-aurum-gold">
                {FREE_SUPPLY.toLocaleString()}
              </dd>
              <dd className="font-mono text-[11px] text-muted-grey">1 per wallet</dd>
            </div>
            <div className="glass rounded-2xl p-4">
              <dt className="font-mono text-[11px] uppercase tracking-widest text-muted-grey">
                Paid mint
              </dt>
              <dd className="mt-1 font-display text-2xl font-bold text-bone">
                {PAID_PRICE_BNB} BNB
              </dd>
              <dd className="font-mono text-[11px] text-muted-grey">max 10 / wallet</dd>
            </div>
          </dl>

          {CONTRACT_DEPLOYED ? (
            <p className="mt-6 inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">
              <span aria-hidden="true">◆</span>
              Live on BSC Mainnet — see the mint dashboard below.
            </p>
          ) : (
            <p className="mt-6 inline-flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
              <span aria-hidden="true">◆</span>
              Contract not deployed — minting opens after the approved mainnet
              deployment (Stage 9).
            </p>
          )}
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute -inset-6 rounded-[2.5rem] bg-aurum-gold/15 blur-3xl animate-glow-pulse" />
          <div className="glass-strong relative overflow-hidden rounded-[2rem] p-3 animate-float">
            <img
              src={`/artwork/${FEATURED_TOKEN_ID}.webp`}
              alt={`AURUM AGENTS #${FEATURED_TOKEN_ID} — ${FEATURED_RARITY} agent`}
              className="aspect-square w-full rounded-[1.6rem] object-cover"
              width={768}
              height={768}
            />
            <div className="absolute inset-x-6 bottom-6 flex items-center justify-between rounded-2xl bg-black/60 px-4 py-3 backdrop-blur-md">
              <div>
                <p className="font-mono text-xs text-muted-grey">Featured agent</p>
                <p className="font-display text-lg font-bold text-bone">
                  #{FEATURED_TOKEN_ID} · {FEATURED_RARITY}
                </p>
              </div>
              <span className="rounded-full border border-yellow-400/50 bg-yellow-400/15 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-aurum-gold">
                Aurum Gold
              </span>
            </div>
          </div>
          <div className="absolute -right-3 -top-3 hidden rotate-12 rounded-xl border border-antique-gold/50 bg-obsidian px-3 py-2 font-mono text-xs text-bright-gold shadow-lg sm:block">
            1 of 5,555
          </div>
        </div>
      </div>
    </section>
  );
}
