/**
 * "Recent activity" feed (Stage 6).
 *
 * Read-only: this view never signs anything. Every entry comes from a
 * real on-chain event — past logs over the last 10,000 blocks, plus live
 * events as they land. Nothing is ever invented: no fake hashes, no fake
 * stats, no fabricated history.
 *
 * While the contract is not deployed there are no events to show, so the
 * view renders CONTRACT NOT DEPLOYED honestly instead of an empty feed.
 */
import { bscScanTxUrl } from "../config/contract";
import {
  useActivityFeed,
  type ActivityEntry,
} from "../hooks/useActivityFeed";

function formatTime(entry: ActivityEntry): string {
  if (entry.timestamp !== undefined) {
    return new Date(entry.timestamp * 1000).toLocaleString();
  }
  return `Block #${entry.blockNumber.toString()}`;
}

export default function ActivityFeed() {
  const { deployed, historyStatus, entries } = useActivityFeed();

  return (
    <section id="activity" className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
      <div className="mb-8">
        <h2 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
          Recent <span className="text-gold-gradient">activity</span>
        </h2>
        <p className="mt-2 max-w-2xl text-muted-grey">
          Contract events from BNB Smart Chain — newest first.
        </p>
      </div>

      {!deployed && (
        <div className="glass rounded-2xl p-6 text-muted-grey">
          <p className="font-mono text-sm uppercase tracking-widest text-aurum-gold">
            Contract not deployed
          </p>
          <p className="mt-2">
            CONTRACT NOT DEPLOYED — recent activity appears here after the
            Stage 9 deployment.
          </p>
        </div>
      )}

      {deployed && historyStatus === "loading" && (
        <div className="glass rounded-2xl p-6 text-muted-grey">
          Loading recent activity…
        </div>
      )}

      {deployed && historyStatus !== "loading" && (
        <>
          {historyStatus === "unavailable" && (
            <div className="glass mb-4 rounded-2xl p-6 text-muted-grey">
              <p className="font-mono text-sm uppercase tracking-widest text-aurum-gold">
                Event history unavailable
              </p>
              <p className="mt-2">
                Event history unavailable from this RPC — showing live events
                only.
              </p>
            </div>
          )}

          {entries.length === 0 && (
            <div className="glass rounded-2xl p-6 text-muted-grey">
              <p>No contract activity yet.</p>
            </div>
          )}

          {entries.length > 0 && (
            <ol className="space-y-3">
              {entries.map((entry) => (
                <li
                  key={entry.key}
                  className="glass flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="font-display text-base font-bold text-bone">
                      {entry.label}
                    </p>
                    {entry.detail !== undefined && (
                      <p className="mt-0.5 truncate font-mono text-xs text-muted-grey">
                        {entry.detail}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs text-muted-grey">
                      {formatTime(entry)}
                    </p>
                    <a
                      href={bscScanTxUrl(entry.transactionHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 inline-block font-mono text-[11px] uppercase tracking-widest text-aurum-gold hover:underline"
                    >
                      BscScan ↗
                    </a>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
