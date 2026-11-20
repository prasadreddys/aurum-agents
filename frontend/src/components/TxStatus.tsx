/**
 * Transaction status line (Stage 5).
 *
 * Renders nothing while idle. Every other phase shows a short status plus
 * a BscScan link once a hash exists, so the user can verify the mint
 * on-chain themselves. No hash, status or error is ever invented.
 */
import type { TxPhase } from "../hooks/useAurumWrites";
import { bscScanTxUrl } from "../config/contract";

interface TxStatusProps {
  phase: TxPhase;
  hash?: `0x${string}`;
  error?: string;
  /** Human label for the confirmed line, e.g. "Free mint". */
  label: string;
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-4)}`;
}

export default function TxStatus({ phase, hash, error, label }: TxStatusProps) {
  if (phase === "idle") return null;

  if (phase === "awaiting") {
    return (
      <p className="mt-3 text-center font-mono text-xs text-amber-200">
        Waiting for wallet confirmation…
      </p>
    );
  }

  if (phase === "pending") {
    return (
      <p className="mt-3 text-center font-mono text-xs text-amber-200">
        Transaction pending…{" "}
        {hash !== undefined && (
          <>
            <span className="text-bone">{shortHash(hash)}</span>{" "}
            <a
              href={bscScanTxUrl(hash)}
              target="_blank"
              rel="noreferrer"
              className="text-aurum-gold underline underline-offset-2"
            >
              View on BscScan ↗
            </a>
          </>
        )}
      </p>
    );
  }

  if (phase === "confirmed") {
    return (
      <p className="mt-3 text-center font-mono text-xs text-emerald-300">
        ✓ {label} confirmed{" "}
        {hash !== undefined && (
          <a
            href={bscScanTxUrl(hash)}
            target="_blank"
            rel="noreferrer"
            className="text-aurum-gold underline underline-offset-2"
          >
            View on BscScan ↗
          </a>
        )}
      </p>
    );
  }

  // failed
  return (
    <div className="mt-3 text-center">
      <p className="font-mono text-xs text-red-300">Transaction failed</p>
      {error !== undefined && (
        <p className="mt-1 break-words font-mono text-xs text-muted-grey">
          {error}
        </p>
      )}
    </div>
  );
}
