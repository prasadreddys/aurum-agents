import { CONTRACT_DEPLOYED } from "../config/contract";

export default function Footer() {
  return (
    <footer className="border-t border-white/5">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <p className="font-display text-2xl font-bold uppercase tracking-tight">
              <span className="text-aurum-gold">Aurum</span>{" "}
              <span className="text-bone">Agents</span>
              <span className="ml-1 text-aurum-gold">◆</span>
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-grey">
              A premium NFT minting platform on BNB Smart Chain Mainnet.
              Forged in gold. Owned on-chain.
            </p>
            {CONTRACT_DEPLOYED ? (
              <p className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 font-mono text-xs text-emerald-200">
                ◆ Live on BSC Mainnet
              </p>
            ) : (
              <p className="mt-4 inline-flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 font-mono text-xs text-amber-200">
                ◆ Contract not deployed
              </p>
            )}
            <p className="mt-4 text-sm">
              <a
                className="text-aurum-gold hover:underline"
                href="https://x.com/AurumAgents"
                target="_blank"
                rel="noreferrer"
              >
                Follow on X — @AurumAgents ↗
              </a>
            </p>
          </div>

          <nav aria-label="Site">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-grey">
              Platform
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><a className="text-bone/80 hover:text-aurum-gold" href="#stats">Collection status</a></li>
              <li><a className="text-bone/80 hover:text-aurum-gold" href="#mint">Mint dashboard</a></li>
              <li><a className="text-bone/80 hover:text-aurum-gold" href="#gallery">Gallery</a></li>
              <li><a className="text-bone/80 hover:text-aurum-gold" href="#prompts">Agent prompt center</a></li>
            </ul>
          </nav>

          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-grey">
              Chain
            </p>
            <ul className="mt-3 space-y-2 font-mono text-sm text-bone/80">
              <li>BNB Smart Chain Mainnet</li>
              <li>Chain ID 56</li>
              <li>ERC-721 · 5,555 supply</li>
              <li>
                <a
                  className="text-aurum-gold hover:underline"
                  href="https://bscscan.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  bscscan.com ↗
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/5 pt-6 text-xs leading-relaxed text-muted-grey">
          <p>
            {CONTRACT_DEPLOYED ? (
              <>
                AURUM AGENTS is live on BNB Smart Chain Mainnet. The verified
                contract address is published in the Collection Status
                section. Never send BNB to an address claiming to be the
                AURUM collection other than the verified contract address.
                This site displays no fabricated statistics.
              </>
            ) : (
              <>
                AURUM AGENTS is a pre-launch project. No contract is deployed,
                no NFTs are minted, and no transactions can be made from this
                site yet. Never send BNB to an address claiming to be the
                AURUM collection before the owner publishes the verified
                contract address. This site displays no fabricated statistics.
              </>
            )}
          </p>
          <p className="mt-2 font-mono">
            Live on BNB Smart Chain Mainnet · Contract verified on
            BscScan · Built with free, open-source tools.
          </p>
        </div>
      </div>
    </footer>
  );
}
