/**
 * Connect modal (Stage 4) — custom modal over wagmi connectors.
 *
 * Wallet order is deliberate and must be preserved:
 *   1. Binance Web3 Wallet (injected `window.binancew3w.ethereum`) — FIRST.
 *   2. MetaMask (injected).
 *   3. WalletConnect v2 — only when a real Reown project ID is configured.
 *      Without one it renders a "needs project ID" state; no fake ID, no
 *      fake connection attempt.
 *
 * There is NO "Connect Binance Agent Wallet" option: the Agentic Wallet
 * has no browser provider and no website connect flow. The WalletConnect
 * QR code below connects WalletConnect-compatible wallets (including
 * Binance Web3 Wallet on mobile) — it is NOT an Agentic Wallet sign-in,
 * and the modal says so explicitly (Binance FAQ warns against signing in
 * to the Agentic Wallet via a third-party website QR code).
 */
import { useEffect, useState } from "react";
import { useAccount, useConnect } from "wagmi";
import type { Connector } from "wagmi";
import QRCode from "qrcode";
import { WALLET_CONNECT_ENABLED } from "../config/env";

type WcProvider = {
  on: (event: string, listener: (uri: string) => void) => void;
};

export default function WalletModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { isConnected } = useAccount();
  const { connectAsync, connectors, error, isPending } = useConnect();
  const [wcUri, setWcUri] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const binanceConnector = connectors.find((c) => c.id === "binance-w3w");
  const metaMaskConnector = connectors.find((c) => c.id === "metaMask");
  const wcConnector = connectors.find((c) => c.id === "walletConnect");

  const binanceDetected =
    typeof window !== "undefined" &&
    window.binancew3w?.ethereum !== undefined;
  const metaMaskDetected =
    typeof window !== "undefined" &&
    (window.ethereum?.isMetaMask === true ||
      window.ethereum?.providers?.some((p) => p.isMetaMask) === true);

  useEffect(() => {
    if (open) {
      setWcUri(null);
      setQrDataUrl(null);
      setLocalError(null);
      setBusyId(null);
    }
  }, [open ]);

  useEffect(() => {
    if (isConnected && open) onClose();
  }, [isConnected, open, onClose]);

  if (!open) return null;

  async function connectInjected(connector: Connector) {
    setLocalError(null);
    setBusyId(connector.id);
    try {
      await connectAsync({ connector, chainId: 56 });
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "Connection failed.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function connectWalletConnect(connector: Connector) {
    setLocalError(null);
    setBusyId(connector.id);
    try {
      const provider = (await (
        connector as unknown as {
          getProvider: () => Promise<WcProvider>;
        }
      ).getProvider()) as WcProvider;
      provider.on("display_uri", (uri: string) => {
        setWcUri(uri);
        QRCode.toDataURL(uri, { width: 256, margin: 1 })
          .then(setQrDataUrl)
          .catch(() => setQrDataUrl(null));
      });
      await connectAsync({ connector, chainId: 56 });
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "WalletConnect failed.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable — the URI stays visible for manual copy */
    }
  }

  const displayError = localError ?? error?.message ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Connect wallet"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-strong max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold uppercase tracking-tight">
              Connect <span className="text-gold-gradient">wallet</span>
            </h2>
            <p className="mt-1 text-sm text-muted-grey">
              BNB Smart Chain Mainnet (56) only. Nothing is signed until you
              approve it in your wallet.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="btn-ghost rounded-xl px-3 py-2 font-mono text-sm"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {/* 1 — Binance Web3 Wallet (first, per approved re-scope) */}
          <div className="rounded-2xl border border-antique-gold/30 bg-black/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-display font-bold text-bone">
                  Binance Web3 Wallet
                </p>
                <p className="mt-0.5 font-mono text-[11px] uppercase tracking-widest text-aurum-gold">
                  Recommended · injected
                </p>
              </div>
              {binanceConnector && (
                <button
                  type="button"
                  disabled={isPending || !binanceDetected}
                  onClick={() => connectInjected(binanceConnector)}
                  className="btn-gold rounded-xl px-4 py-2.5 text-xs uppercase tracking-wide"
                >
                  {busyId === "binance-w3w"
                    ? "Waiting…"
                    : binanceDetected
                      ? "Connect"
                      : "Not detected"}
                </button>
              )}
            </div>
            {!binanceDetected && (
              <p className="mt-2 text-xs leading-relaxed text-muted-grey">
                Not detected in this browser. Open this site in the Binance
                App&apos;s DApp browser, where Binance Web3 Wallet is built
                in.
              </p>
            )}
          </div>

          {/* 2 — MetaMask */}
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-display font-bold text-bone">MetaMask</p>
                <p className="mt-0.5 font-mono text-[11px] uppercase tracking-widest text-muted-grey">
                  Injected
                </p>
              </div>
              {metaMaskConnector && (
                <button
                  type="button"
                  disabled={isPending || !metaMaskDetected}
                  onClick={() => connectInjected(metaMaskConnector)}
                  className="btn-ghost rounded-xl px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
                >
                  {busyId === "metaMask"
                    ? "Waiting…"
                    : metaMaskDetected
                      ? "Connect"
                      : "Not detected"}
                </button>
              )}
            </div>
            {!metaMaskDetected && (
              <p className="mt-2 text-xs leading-relaxed text-muted-grey">
                Not detected in this browser.{" "}
                <a
                  className="text-aurum-gold underline"
                  href="https://metamask.io/download/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Install MetaMask
                </a>{" "}
                or open this site in the MetaMask browser.
              </p>
            )}
          </div>

          {/* 3 — WalletConnect v2 */}
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-display font-bold text-bone">
                  WalletConnect
                </p>
                <p className="mt-0.5 font-mono text-[11px] uppercase tracking-widest text-muted-grey">
                  Scan with a mobile wallet
                </p>
              </div>
              {WALLET_CONNECT_ENABLED && wcConnector ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => connectWalletConnect(wcConnector)}
                  className="btn-ghost rounded-xl px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
                >
                  {busyId === "walletConnect" && !wcUri
                    ? "Waiting…"
                    : "Connect"}
                </button>
              ) : (
                <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-amber-200">
                  Needs project ID
                </span>
              )}
            </div>
            {!WALLET_CONNECT_ENABLED ? (
              <p className="mt-2 text-xs leading-relaxed text-muted-grey">
                WalletConnect needs a free Reown Cloud project ID
                (VITE_WC_PROJECT_ID) — not configured yet. No WalletConnect
                session is possible until the owner creates one at
                cloud.reown.com. No ID has been invented.
              </p>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-muted-grey">
                Scan the code with a WalletConnect-compatible mobile wallet
                (including Binance Web3 Wallet). This QR code connects a
                wallet — it is <strong className="text-bone">not</strong> a
                Binance Agentic Wallet sign-in; never sign in to an Agentic
                Wallet via a website QR code.
              </p>
            )}
            {wcUri && (
              <div className="mt-3 rounded-2xl bg-white p-3 text-center">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="WalletConnect pairing code — scan with a mobile wallet"
                    className="mx-auto h-56 w-56"
                    width={224}
                    height={224}
                  />
                ) : (
                  <p className="break-all p-2 font-mono text-[11px] text-black">
                    {wcUri}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => copy(wcUri)}
                  className="mt-2 rounded-lg border border-black/20 px-3 py-1.5 font-mono text-xs text-black"
                >
                  Copy pairing URI
                </button>
              </div>
            )}
          </div>
        </div>

        {displayError && (
          <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-xs leading-relaxed text-red-200">
            Connection failed: {displayError}
          </p>
        )}

        <p className="mt-4 text-center font-mono text-[11px] leading-relaxed text-muted-grey">
          AURUM AGENTS never switches networks or signs anything without
          your explicit approval in your wallet.
        </p>
      </div>
    </div>
  );
}
