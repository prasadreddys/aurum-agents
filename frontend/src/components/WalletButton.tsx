/**
 * Header wallet button (Stage 4).
 *
 * Disconnected: "Connect wallet" opens the connect modal.
 * Connected: short address + BNB balance (BSC Mainnet only), opening a
 * panel with the full address (copy), balance, chain, BscScan link and
 * Disconnect. On any chain other than 56 it shows "Wrong network".
 */
import { useState } from "react";
import { useAccount, useBalance, useDisconnect } from "wagmi";
import { formatEther } from "viem";
import WalletModal from "./WalletModal";
import { bscScanAddressUrl } from "../config/contract";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function WalletButton() {
  const { address, isConnected, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const [modalOpen, setModalOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: balance } = useBalance({
    address,
    chainId: 56,
    query: { enabled: isConnected && chainId === 56 },
  });

  if (!isConnected || !address) {
    return (
      <>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="btn-gold rounded-xl px-4 py-2.5 text-xs uppercase tracking-wide sm:px-5 sm:text-sm"
        >
          Connect wallet
        </button>
        <WalletModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  const wrongNetwork = chainId !== 56;
  const balanceText =
    balance !== undefined
      ? `${Number(formatEther(balance.value)).toFixed(4)} BNB`
      : "—";

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address as string);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — address stays visible for manual copy */
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setPanelOpen((o) => !o)}
        aria-expanded={panelOpen}
        className={`rounded-xl px-4 py-2.5 font-mono text-xs sm:text-sm ${
          wrongNetwork
            ? "border border-amber-400/60 bg-amber-400/15 text-amber-200"
            : "border border-antique-gold/50 bg-aurum-gold/10 text-aurum-gold"
        }`}
      >
        {wrongNetwork ? "⚠ Wrong network" : "◆"} {shortAddress(address)}
        {!wrongNetwork && (
          <span className="ml-2 hidden text-bone/80 sm:inline">
            {balanceText}
          </span>
        )}
      </button>

      {panelOpen && (
        <div className="glass-strong absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl p-4">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-grey">
            Connected wallet
          </p>
          <p className="mt-1 break-all font-mono text-sm text-bone">
            {address}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={copyAddress}
              className="btn-ghost flex-1 rounded-xl px-3 py-2 text-xs font-semibold"
            >
              {copied ? "✓ Copied" : "Copy address"}
            </button>
            <a
              className="btn-ghost flex-1 rounded-xl px-3 py-2 text-center text-xs font-semibold"
              href={bscScanAddressUrl(address)}
              target="_blank"
              rel="noreferrer"
            >
              BscScan ↗
            </a>
          </div>
          <dl className="mt-4 space-y-2 border-t border-white/5 pt-3 font-mono text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-grey">BNB balance</dt>
              <dd className="text-bone">{balanceText}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-grey">Network</dt>
              <dd className={wrongNetwork ? "text-amber-200" : "text-bone"}>
                {wrongNetwork
                  ? `Chain ${chainId ?? "?"} — not BSC`
                  : "BSC Mainnet · 56"}
              </dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => {
              disconnect();
              setPanelOpen(false);
            }}
            className="btn-ghost mt-4 w-full rounded-xl px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
          >
            Disconnect
          </button>
        </div>
      )}
      <WalletModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
