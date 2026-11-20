/**
 * "My NFTs" gallery-ownership view (Stage 5).
 *
 * Read-only: this view never signs anything. Every token shown here comes
 * from the on-chain enumeration in `useOwnedTokensMeta` (balanceOf +
 * tokenOfOwnerByIndex) — a token ID is never rendered unless the chain
 * proved the connected wallet owns it.
 *
 * While the contract is not deployed there is nothing to enumerate, so the
 * view renders CONTRACT NOT DEPLOYED honestly instead of fake holdings.
 */
import { useAccount } from "wagmi";
import { bscScanTokenUrl } from "../config/contract";
import { RARITY_BADGE } from "../data/rarity";
import { useOwnedTokensMeta } from "../hooks/useOwnedTokens";

const TOKEN_URI_PREVIEW_LENGTH = 32;

function truncateTokenURI(tokenURI: string): string {
  return tokenURI.length > TOKEN_URI_PREVIEW_LENGTH
    ? `${tokenURI.slice(0, TOKEN_URI_PREVIEW_LENGTH)}…`
    : tokenURI;
}

/**
 * tokenURI comes from the chain, so its scheme is untrusted. React does
 * not sanitise href schemes — a `javascript:` tokenURI would execute on
 * click. Only http(s) and ipfs links are clickable; anything else renders
 * as plain text (Stage 7 hardening).
 */
function isSafeTokenURI(tokenURI: string): boolean {
  return (
    tokenURI.startsWith("https://") ||
    tokenURI.startsWith("http://") ||
    tokenURI.startsWith("ipfs://")
  );
}

export default function MyNFTs() {
  const { address } = useAccount();
  const { deployed, connected, isLoading, balance, tokens } =
    useOwnedTokensMeta(address);

  return (
    <section id="my-nfts" className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
      <div className="mb-8">
        <h2 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
          My <span className="text-gold-gradient">NFTs</span>
        </h2>
        <p className="mt-2 max-w-2xl text-muted-grey">
          Tokens owned by your connected wallet, verified on-chain.
        </p>
      </div>

      {!connected && (
        <div className="glass rounded-2xl p-6 text-muted-grey">
          <p className="font-mono text-sm uppercase tracking-widest text-aurum-gold">
            Connect wallet
          </p>
          <p className="mt-2">
            CONNECT WALLET — connect a wallet to see the NFTs it owns.
          </p>
        </div>
      )}

      {connected && !deployed && (
        <div className="glass rounded-2xl p-6 text-muted-grey">
          <p className="font-mono text-sm uppercase tracking-widest text-aurum-gold">
            Contract not deployed
          </p>
          <p className="mt-2">
            CONTRACT NOT DEPLOYED — ownership is verified on-chain after the
            Stage 9 deployment.
          </p>
        </div>
      )}

      {connected && deployed && isLoading && (
        <div className="glass rounded-2xl p-6 text-muted-grey">
          Loading your NFTs…
        </div>
      )}

      {connected && deployed && !isLoading && (balance === 0n || tokens.length === 0) && (
        <div className="glass rounded-2xl p-6 text-muted-grey">
          <p>This wallet owns no AURUM AGENTS NFTs yet.</p>
          <p className="mt-2">Mint from the dashboard above.</p>
        </div>
      )}

      {connected && deployed && !isLoading && tokens.length > 0 && (
        <>
          <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-grey">
            You own {tokens.length} {tokens.length === 1 ? "NFT" : "NFTs"}
          </p>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {tokens.map((token) => (
              <article
                key={token.id.toString()}
                className="glass group overflow-hidden rounded-2xl text-left transition-transform hover:-translate-y-1"
              >
                <div className="relative">
                  {/*
                    Artwork is served from the LOCAL /artwork/<id>.webp file.
                    This is the identical asset the on-chain metadata will
                    serve, and it is same-origin, so no CSP issue: the
                    site's connect-src policy only restricts off-origin
                    calls, and this image never leaves the origin.
                  */}
                  <img
                    src={`/artwork/${token.id.toString()}.webp`}
                    alt={`AURUM AGENTS #${token.id.toString()} — ${token.local?.rarity ?? "Unknown rarity"} agent`}
                    loading="lazy"
                    width={768}
                    height={768}
                    className="aspect-square w-full object-cover"
                  />
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-base font-bold text-bone">
                      #{token.id.toString()}
                    </span>
                    {token.local ? (
                      <span
                        className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${RARITY_BADGE[token.local.rarity]}`}
                      >
                        {token.local.rarity}
                      </span>
                    ) : (
                      <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-grey">
                        Unknown rarity
                      </span>
                    )}
                  </div>

                  {token.local && (
                    <p className="mt-1 truncate font-mono text-[11px] text-muted-grey">
                      {token.local.eyes} · {token.local.plating}
                      {token.local.edition === "Aurum Gold"
                        ? " · ◆ Aurum Gold"
                        : ""}
                    </p>
                  )}
                  {token.local && (
                    <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-muted-grey">
                      {token.local.edition} edition
                    </p>
                  )}

                  <div className="mt-3 flex items-center gap-3">
                    <a
                      href={bscScanTokenUrl(token.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[11px] uppercase tracking-widest text-aurum-gold hover:underline"
                    >
                      BscScan ↗
                    </a>
                    {token.tokenURI && isSafeTokenURI(token.tokenURI) && (
                      <a
                        href={token.tokenURI}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[11px] uppercase tracking-widest text-aurum-gold hover:underline"
                      >
                        Metadata ↗
                      </a>
                    )}
                    {token.tokenURI && !isSafeTokenURI(token.tokenURI) && (
                      <span className="font-mono text-[11px] uppercase tracking-widest text-muted-grey">
                        Metadata (untrusted link)
                      </span>
                    )}
                  </div>

                  {token.tokenURI && (
                    <p
                      className="mt-2 truncate font-mono text-[11px] text-muted-grey"
                      title={token.tokenURI}
                    >
                      {truncateTokenURI(token.tokenURI)}
                    </p>
                  )}

                  {token.metadataSource === "local" && (
                    <p className="mt-2 text-[11px] leading-relaxed text-muted-grey">
                      Metadata from local index — on-chain metadata not
                      reachable yet.
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
