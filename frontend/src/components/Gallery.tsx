import { useEffect, useMemo, useState } from "react";
import { CONTRACT_DEPLOYED } from "../config/contract";
import {
  RARITY_BADGE,
  RARITY_COUNT,
  RARITY_ORDER,
  TOTAL_SUPPLY,
  type GalleryToken,
  type Rarity,
} from "../data/rarity";

const PAGE_SIZE = 24;

type RarityFilter = "All" | Rarity;

const TRAIT_LABELS: { key: keyof Omit<GalleryToken, "id" | "rarity" | "edition">; label: string }[] = [
  { key: "background", label: "Background" },
  { key: "plating", label: "Plating" },
  { key: "eyes", label: "Eyes" },
  { key: "accessory", label: "Accessory" },
  { key: "glow", label: "Glow" },
  { key: "effect", label: "Effect" },
];

export default function Gallery() {
  const [tokens, setTokens] = useState<GalleryToken[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState<RarityFilter>("All");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<GalleryToken | null>(null);

  useEffect(() => {
    fetch("/gallery-index.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: GalleryToken[]) => setTokens(data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "failed to load"));
  }, []);

  const filtered = useMemo(() => {
    if (!tokens) return [];
    const q = query.trim();
    return tokens.filter((t) => {
      if (rarity !== "All" && t.rarity !== rarity) return false;
      if (q !== "") {
        if (/^\d+$/.test(q)) {
          if (t.id !== Number(q) && !String(t.id).includes(q)) return false;
        } else if (!String(t.id).includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [tokens, query, rarity]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageTokens = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const applyFilter = (f: RarityFilter) => {
    setRarity(f);
    setPage(1);
  };
  const applyQuery = (q: string) => {
    setQuery(q);
    setPage(1);
  };

  return (
    <section id="gallery" className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
      <div className="mb-8">
        <h2 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
          The <span className="text-gold-gradient">collection</span>
        </h2>
        <p className="mt-2 max-w-2xl text-muted-grey">
          All {TOTAL_SUPPLY.toLocaleString()} generative designs, rendered
          locally. Nothing is minted yet — every token below is unminted until
          the contract deploys. Rarity comes from the actual metadata, not
          from a placeholder.
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["All", ...RARITY_ORDER] as RarityFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => applyFilter(f)}
              className={`rounded-full border px-4 py-2 font-mono text-xs uppercase tracking-widest transition ${
                rarity === f
                  ? "border-aurum-gold bg-aurum-gold/15 text-aurum-gold"
                  : "border-white/10 bg-white/[0.03] text-muted-grey hover:border-antique-gold/40 hover:text-bone"
              }`}
            >
              {f}
              {f !== "All" ? ` · ${RARITY_COUNT[f].toLocaleString()}` : ""}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2">
          <span className="sr-only">Search by token ID</span>
          <input
            type="search"
            inputMode="numeric"
            value={query}
            onChange={(e) => applyQuery(e.target.value)}
            placeholder="Search token ID… e.g. 42"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 font-mono text-sm text-bone placeholder:text-muted-grey focus:border-antique-gold/60 focus:outline-none lg:w-64"
          />
        </label>
      </div>

      {error && (
        <div className="glass rounded-2xl p-6 text-amber-200">
          Gallery data unavailable ({error}). Run the artwork generator and
          the asset copy step — see README.md.
        </div>
      )}
      {!error && !tokens && (
        <div className="glass rounded-2xl p-6 text-muted-grey">Loading gallery…</div>
      )}

      {tokens && (
        <>
          <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-grey">
            Showing {pageTokens.length} of {filtered.length.toLocaleString()} tokens
            {rarity !== "All" ? ` · ${rarity}` : ""} · page {safePage} / {pageCount.toLocaleString()}
          </p>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {pageTokens.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelected(t)}
                className="glass group overflow-hidden rounded-2xl text-left transition-transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-antique-gold"
              >
                <div className="relative">
                  <img
                    src={`/artwork/${t.id}.webp`}
                    alt={`AURUM AGENTS #${t.id} — ${t.rarity} agent`}
                    loading="lazy"
                    width={768}
                    height={768}
                    className="aspect-square w-full object-cover"
                  />
                  <span className="absolute left-2 top-2 rounded-full border border-black/40 bg-black/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-amber-200 backdrop-blur-sm">
                    Unminted
                  </span>
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-base font-bold text-bone">
                      #{t.id}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${RARITY_BADGE[t.rarity]}`}
                    >
                      {t.rarity}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-mono text-[11px] text-muted-grey">
                    {t.eyes} · {t.plating}
                    {t.edition === "Aurum Gold" ? " · ◆ Aurum Gold" : ""}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="glass mt-4 rounded-2xl p-8 text-center text-muted-grey">
              No tokens match that search. Token IDs run from 1 to {TOTAL_SUPPLY}.
            </div>
          )}

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
                className="btn-ghost rounded-xl px-4 py-2 text-sm disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="px-3 font-mono text-sm text-muted-grey">
                Page {safePage} of {pageCount.toLocaleString()}
              </span>
              <button
                type="button"
                disabled={safePage >= pageCount}
                onClick={() => setPage(safePage + 1)}
                className="btn-ghost rounded-xl px-4 py-2 text-sm disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`AURUM AGENTS #${selected.id} details`}
        >
          <div
            className="glass-strong max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-5 sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl font-bold text-bone">
                  AURUM AGENTS #{selected.id}
                </h3>
                {!CONTRACT_DEPLOYED && (
                  <p className="mt-1 font-mono text-xs uppercase tracking-widest text-amber-200">
                    Unminted — contract not deployed
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close details"
                className="btn-ghost h-9 w-9 shrink-0 rounded-xl text-lg"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <img
                src={`/artwork/${selected.id}.webp`}
                alt={`AURUM AGENTS #${selected.id} — ${selected.rarity} agent`}
                width={768}
                height={768}
                className="aspect-square w-full rounded-2xl object-cover"
              />
              <div>
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-widest ${RARITY_BADGE[selected.rarity]}`}
                  >
                    {selected.rarity}
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-bone">
                    {selected.edition} edition
                  </span>
                </div>
                <dl className="mt-5 space-y-2 font-mono text-sm">
                  {TRAIT_LABELS.map(({ key, label }) => (
                    <div key={key} className="flex justify-between gap-4 border-b border-white/5 pb-2">
                      <dt className="text-muted-grey">{label}</dt>
                      <dd className="text-right text-bone">{selected[key]}</dd>
                    </div>
                  ))}
                </dl>
                <a
                  href={`/metadata/${selected.id}.json`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost mt-5 inline-block rounded-xl px-4 py-2.5 text-sm"
                >
                  View metadata JSON →
                </a>
                <p className="mt-3 text-xs leading-relaxed text-muted-grey">
                  Ownership verification opens after deployment: the token
                  will be checkable on BscScan by token ID and owner address.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
