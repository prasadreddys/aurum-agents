/**
 * Wrong-network banner (Stage 4).
 *
 * AURUM AGENTS runs on BNB Smart Chain Mainnet (chain 56) only. If the
 * connected wallet is on any other chain, this banner asks the user to
 * switch — via an explicit click that calls wallet_switchEthereumChain.
 * The app NEVER switches networks silently or on connect.
 */
import { useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { bsc } from "wagmi/chains";

export default function NetworkBanner() {
  const { isConnected, chainId, chain } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  const [error, setError] = useState<string | null>(null);

  if (!isConnected || chainId === 56) return null;

  async function switchToBsc() {
    setError(null);
    try {
      await switchChainAsync({ chainId: bsc.id });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Switch failed — add BNB Smart Chain Mainnet (chain 56) in your wallet and try again.",
      );
    }
  }

  return (
    <div className="border-b border-amber-400/30 bg-amber-400/10">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
        <p className="text-sm text-amber-100">
          <strong>Wrong network:</strong> you are connected to{" "}
          {chain?.name ?? `chain ${chainId}`} (chain {chainId}). AURUM
          AGENTS runs on BNB Smart Chain Mainnet (56) only — balances and
          minting are unavailable until you switch.
        </p>
        <button
          type="button"
          onClick={switchToBsc}
          disabled={isPending}
          className="btn-gold shrink-0 rounded-xl px-4 py-2 text-xs uppercase tracking-wide"
        >
          {isPending ? "Waiting…" : "Switch to BSC Mainnet"}
        </button>
      </div>
      {error && (
        <p className="mx-auto max-w-7xl px-5 pb-3 text-xs text-red-200 sm:px-8">
          Switch failed: {error}
        </p>
      )}
    </div>
  );
}
