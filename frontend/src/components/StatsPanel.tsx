import type { ReactNode } from "react";
import { FREE_SUPPLY, PAID_SUPPLY, TOTAL_SUPPLY } from "../data/rarity";
import { CONTRACT_ADDRESS, bscScanAddressUrl } from "../config/contract";
import { useCollectionReads } from "../hooks/useAurumReads";

/**
 * Live collection statistics.
 *
 * Every live value comes from on-chain contract reads via
 * useCollectionReads(). Until the contract is deployed on BNB Smart Chain
 * Mainnet, live values render CONTRACT NOT DEPLOYED — never a fabricated
 * number. The only fixed numbers are the collection design constants
 * (5,555 / 1,111 / 4,444), labelled as design.
 */
const NOT_DEPLOYED = "CONTRACT NOT DEPLOYED";

function formatCount(value: bigint | undefined): string {
  return value === undefined ? "DATA UNAVAILABLE" : value.toLocaleString();
}

interface Stat {
  label: string;
  value: ReactNode;
  sub: string;
  live: boolean;
}

export default function StatsPanel() {
  const reads = useCollectionReads();

  const liveValue = (value: bigint | undefined): string => {
    if (!reads.deployed) return NOT_DEPLOYED;
    if (reads.isLoading) return "Loading…";
    if (reads.isError) return "DATA UNAVAILABLE";
    return formatCount(value);
  };

  const contractAddress: ReactNode = !reads.deployed
    ? NOT_DEPLOYED
    : reads.isLoading
      ? "Loading…"
      : reads.isError || CONTRACT_ADDRESS === undefined
        ? "DATA UNAVAILABLE"
        : (
          <a
            href={bscScanAddressUrl(CONTRACT_ADDRESS)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-amber-400/50 underline-offset-4 transition-colors hover:text-amber-100"
          >
            {`${CONTRACT_ADDRESS.slice(0, 6)}…${CONTRACT_ADDRESS.slice(-4)}`}
          </a>
        );

  const STATS: Stat[] = [
    { label: "Collection size (design)", value: TOTAL_SUPPLY.toLocaleString(), sub: "5,555 unique agents", live: false },
    { label: "Total minted", value: liveValue(reads.totalMinted), sub: "read from contract after deploy", live: true },
    { label: "Free minted", value: liveValue(reads.freeMinted), sub: `of ${FREE_SUPPLY.toLocaleString()} free allocation`, live: true },
    { label: "Free remaining", value: liveValue(reads.remainingFree), sub: "free mint sells out at 1,111", live: true },
    { label: "Paid minted", value: liveValue(reads.paidMinted), sub: `of ${PAID_SUPPLY.toLocaleString()} paid allocation`, live: true },
    { label: "Paid remaining", value: liveValue(reads.remainingPaid), sub: "0.001 BNB per NFT", live: true },
    { label: "Contract address", value: contractAddress, sub: "published at Stage 9 deployment", live: true },
    { label: "Floor price", value: "DATA UNAVAILABLE", sub: "no secondary market yet", live: true },
  ];

  return (
    <section id="stats" className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
            Collection <span className="text-gold-gradient">status</span>
          </h2>
          <p className="mt-2 max-w-2xl text-muted-grey">
            All supply counters come from actual contract reads. Until the
            contract is deployed on BNB Smart Chain Mainnet, live values are
            honestly unavailable — never invented.
          </p>
        </div>
        {reads.deployed ? (
          <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 font-mono text-xs uppercase tracking-widest text-emerald-200">
            ◆ Live on BSC Mainnet
          </span>
        ) : (
          <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-2 font-mono text-xs uppercase tracking-widest text-amber-200">
            ◆ Contract not deployed
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="glass rounded-2xl p-5 transition-transform hover:-translate-y-1">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-grey">
              {s.label}
            </p>
            <p
              className={`mt-2 font-display font-bold leading-tight ${
                s.live
                  ? "text-base text-amber-200 sm:text-lg"
                  : "text-2xl text-bone sm:text-3xl"
              }`}
            >
              {s.value}
            </p>
            <p className="mt-1 text-xs text-muted-grey">{s.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
