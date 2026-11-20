/**
 * Owner-gated admin panel (Stage 5).
 *
 * Gating, in order:
 *   (a) contract not deployed  -> CONTRACT NOT DEPLOYED panel, no controls
 *   (b) deployed, wallet off   -> CONNECT WALLET panel, no controls
 *   (c) deployed, connected, not the owner -> identity panel only, no controls
 *   (d) deployed, connected as owner -> the on-chain controls below
 *
 * Every action is an on-chain transaction signed by the owner wallet in
 * their own browser. Nothing here ever signs, sends, or simulates a
 * transaction on its own, and no control is enabled off BSC Mainnet
 * (chain 56). All displayed values come from live reads; while the
 * contract is not deployed every value shows CONTRACT NOT DEPLOYED.
 *
 * Contract admin functions: pause() / unpause(), withdraw(),
 * setBaseURI(string) (reverts once frozen), freezeBaseURI() (one-way).
 * tokenURI is baseURI + "<tokenId>.json", so a base URI must end with
 * "/" — enforced in the UI before setBaseURI can be called.
 */
import { useState } from "react";
import { useAccount, useBalance } from "wagmi";
import type { Abi } from "viem";
import { formatEther } from "viem";
import { useCollectionReads } from "../hooks/useAurumReads";
import { useContractWrite } from "../hooks/useAurumWrites";
import TxStatus from "./TxStatus";
import {
  CONTRACT_ADDRESS,
  CONTRACT_DEPLOYED,
  ZERO_ADDRESS,
  aurumAgentsAbi,
  bscScanAddressUrl,
} from "../config/contract";

/**
 * Same widening as useAurumReads.ts: the ABI is kept `as const` in config,
 * but the write calls address functions by plain string names, so they use
 * the ABI widened to viem's generic `Abi` type.
 */
const looseAbi = aurumAgentsAbi as unknown as Abi;

export default function AdminPanel() {
  const { address, isConnected, chainId } = useAccount();
  const reads = useCollectionReads();

  // One write hook instance per action, each with its own tx state.
  const pauseFlow = useContractWrite();
  const withdrawFlow = useContractWrite();
  const baseUriFlow = useContractWrite();
  const freezeFlow = useContractWrite();

  const { data: contractBalance } = useBalance({
    address: CONTRACT_ADDRESS,
    chainId: 56,
    query: { enabled: CONTRACT_DEPLOYED },
  });

  const [newBaseURI, setNewBaseURI] = useState("");
  const [freezeArmed, setFreezeArmed] = useState(false);

  const ownerAddress = reads.owner;
  const isOwner =
    CONTRACT_DEPLOYED &&
    isConnected &&
    address !== undefined &&
    ownerAddress !== undefined &&
    address.toLowerCase() === ownerAddress.toLowerCase();
  const onBscMainnet = chainId === 56;
  // Shared gate for every control: deployed, owner, BSC Mainnet.
  const controlsEnabled = CONTRACT_DEPLOYED && isOwner && onBscMainnet;

  const paused = reads.paused;
  const baseURIFrozen = reads.baseURIFrozen === true;

  // --- Withdraw ---
  const balanceValue =
    contractBalance !== undefined
      ? Number(formatEther(contractBalance.value)).toFixed(4)
      : undefined;
  const balanceIsZero =
    contractBalance !== undefined && contractBalance.value === 0n;

  // --- Base URI ---
  const trimmedBaseURI = newBaseURI.trim();
  const baseURIValid =
    trimmedBaseURI.length > 0 && trimmedBaseURI.endsWith("/");
  const baseURIError =
    trimmedBaseURI.length > 0 && !trimmedBaseURI.endsWith("/")
      ? "Base URI must end with '/' — tokenURI is baseURI + '<id>.json'."
      : undefined;

  function handlePauseToggle() {
    const target = CONTRACT_ADDRESS ?? ZERO_ADDRESS;
    if (paused) {
      pauseFlow.write({
        address: target,
        abi: looseAbi,
        functionName: "unpause",
        args: [],
      });
    } else {
      pauseFlow.write({
        address: target,
        abi: looseAbi,
        functionName: "pause",
        args: [],
      });
    }
  }

  function handleWithdraw() {
    withdrawFlow.write({
      address: CONTRACT_ADDRESS ?? ZERO_ADDRESS,
      abi: looseAbi,
      functionName: "withdraw",
      args: [],
    });
  }

  function handleSetBaseURI() {
    if (!baseURIValid) return;
    baseUriFlow.write({
      address: CONTRACT_ADDRESS ?? ZERO_ADDRESS,
      abi: looseAbi,
      functionName: "setBaseURI",
      args: [trimmedBaseURI],
    });
  }

  function handleFreezeClick() {
    if (!freezeArmed) {
      setFreezeArmed(true);
      return;
    }
    setFreezeArmed(false);
    freezeFlow.write({
      address: CONTRACT_ADDRESS ?? ZERO_ADDRESS,
      abi: looseAbi,
      functionName: "freezeBaseURI",
      args: [],
    });
  }

  return (
    <section id="admin" className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
      <div className="mb-8">
        <h2 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
          Admin <span className="text-gold-gradient">panel</span>
        </h2>
        <p className="mt-2 max-w-2xl text-muted-grey">
          Contract owner controls. Every action is an on-chain transaction
          signed by the owner wallet.
        </p>
      </div>

      {/* (a) Contract not deployed — no controls exist yet. */}
      {!CONTRACT_DEPLOYED && (
        <div className="glass rounded-3xl p-7">
          <p className="font-mono text-sm uppercase tracking-widest text-aurum-gold">
            CONTRACT NOT DEPLOYED
          </p>
          <p className="mt-2 text-muted-grey">
            Admin controls appear after the Stage 9 deployment.
          </p>
        </div>
      )}

      {/* (b) Deployed, wallet disconnected. */}
      {CONTRACT_DEPLOYED && !isConnected && (
        <div className="glass rounded-3xl p-7">
          <p className="font-mono text-sm uppercase tracking-widest text-aurum-gold">
            CONNECT WALLET
          </p>
          <p className="mt-2 text-muted-grey">
            Connect the owner wallet to see admin controls.
          </p>
        </div>
      )}

      {/* (c) Deployed, connected, owner read still loading — do not
          mistake "unknown yet" for "not the owner". */}
      {CONTRACT_DEPLOYED &&
        isConnected &&
        ownerAddress === undefined &&
        reads.isLoading && (
          <div className="glass rounded-3xl p-7">
            <p className="font-mono text-sm uppercase tracking-widest text-muted-grey">
              Loading owner…
            </p>
          </div>
        )}

      {/* (c) Deployed, connected, owner read finished but unavailable. */}
      {CONTRACT_DEPLOYED &&
        isConnected &&
        ownerAddress === undefined &&
        !reads.isLoading && (
          <div className="glass rounded-3xl p-7">
            <p className="font-mono text-sm uppercase tracking-widest text-aurum-gold">
              DATA UNAVAILABLE
            </p>
            <p className="mt-2 text-muted-grey">
              The contract owner address could not be read, so admin controls
              cannot be shown.
            </p>
          </div>
        )}

      {/* (c) Deployed, connected, but not the owner — identity only, never controls. */}
      {CONTRACT_DEPLOYED &&
        isConnected &&
        ownerAddress !== undefined &&
        !isOwner && (
        <div className="glass rounded-3xl p-7">
          <p className="font-mono text-sm uppercase tracking-widest text-aurum-gold">
            You are not the contract owner.
          </p>
          <p className="mt-2 text-muted-grey">
            Admin controls are only available to the contract owner wallet.
          </p>
          <dl className="mt-5 space-y-3 border-t border-white/5 pt-4 font-mono text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-widest text-muted-grey">
                Connected wallet
              </dt>
              <dd className="mt-1 break-all text-bone">
                {address ?? "DATA UNAVAILABLE"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-widest text-muted-grey">
                Contract owner
              </dt>
              <dd className="mt-1 break-all">
                <a
                  className="text-aurum-gold underline decoration-antique-gold/50 underline-offset-2"
                  href={bscScanAddressUrl(ownerAddress)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {ownerAddress} ↗
                </a>
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* (d) Deployed, connected as owner — the controls. */}
      {isOwner && (
        <div className="space-y-6">
          {!onBscMainnet && (
            <div className="rounded-2xl border border-amber-400/60 bg-amber-400/10 p-4 text-sm text-amber-200">
              Wrong network — switch to BSC Mainnet (chain 56) to use admin
              controls. The network is never switched for you.
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* 1. Pause / Unpause */}
            <div className="glass rounded-3xl p-7">
              <p className="font-mono text-[11px] uppercase tracking-widest text-visor-emerald">
                Minting state
              </p>
              <p className="mt-2 font-display text-2xl font-bold text-bone">
                {paused === undefined
                  ? "DATA UNAVAILABLE"
                  : paused
                    ? "Minting paused"
                    : "Minting active"}
              </p>
              <p className="mt-1 text-sm text-muted-grey">
                Pausing stops free and paid mints; existing tokens still
                transfer.
              </p>
              <button
                type="button"
                onClick={handlePauseToggle}
                disabled={!controlsEnabled || pauseFlow.isBusy}
                className="btn-gold mt-5 rounded-xl px-5 py-2.5 text-xs font-semibold uppercase tracking-wide"
              >
                {paused ? "Unpause minting" : "Pause minting"}
              </button>
              <TxStatus
                phase={pauseFlow.phase}
                hash={pauseFlow.hash}
                error={pauseFlow.error}
                label={paused ? "Unpause minting" : "Pause minting"}
              />
            </div>

            {/* 2. Withdraw */}
            <div className="glass rounded-3xl p-7">
              <p className="font-mono text-[11px] uppercase tracking-widest text-visor-emerald">
                Contract balance
              </p>
              <p className="mt-2 font-display text-2xl font-bold text-bone">
                {balanceValue === undefined
                  ? "DATA UNAVAILABLE"
                  : `${balanceValue} BNB`}
              </p>
              <p className="mt-1 text-sm text-muted-grey">
                Withdraw sends the whole contract balance to the owner wallet.
              </p>
              <button
                type="button"
                onClick={handleWithdraw}
                disabled={
                  !controlsEnabled ||
                  withdrawFlow.isBusy ||
                  contractBalance === undefined ||
                  balanceIsZero
                }
                className="btn-gold mt-5 rounded-xl px-5 py-2.5 text-xs font-semibold uppercase tracking-wide"
              >
                Withdraw {balanceValue ?? "…"} BNB to owner
              </button>
              {balanceIsZero && (
                <p className="mt-3 text-sm text-muted-grey">
                  Contract balance is 0 BNB — nothing to withdraw.
                </p>
              )}
              <TxStatus
                phase={withdrawFlow.phase}
                hash={withdrawFlow.hash}
                error={withdrawFlow.error}
                label="Withdraw contract balance"
              />
            </div>

            {/* 3. Base URI */}
            <div className="glass rounded-3xl p-7">
              <p className="font-mono text-[11px] uppercase tracking-widest text-visor-emerald">
                Base URI
              </p>
              <p className="mt-2 font-display text-2xl font-bold text-bone">
                {baseURIFrozen ? "Frozen" : "Set base URI"}
              </p>
              <p className="mt-1 text-sm text-muted-grey">
                Token metadata lives at baseURI + &quot;&lt;tokenId&gt;.json
                &quot; — the base URI must end with &quot;/&quot;.
              </p>
              <label className="mt-5 block">
                <span className="sr-only">New base URI</span>
                <input
                  type="url"
                  value={newBaseURI}
                  onChange={(e) => setNewBaseURI(e.target.value)}
                  disabled={!controlsEnabled || baseURIFrozen}
                  placeholder="https://example.com/metadata/"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 font-mono text-sm text-bone placeholder:text-muted-grey focus:border-antique-gold/60 focus:outline-none disabled:opacity-50"
                />
              </label>
              {baseURIError && (
                <p className="mt-2 text-sm text-amber-200">{baseURIError}</p>
              )}
              {baseURIFrozen && (
                <p className="mt-2 text-sm text-amber-200">
                  Base URI is frozen — it can no longer be changed.
                </p>
              )}
              <button
                type="button"
                onClick={handleSetBaseURI}
                disabled={
                  !controlsEnabled ||
                  baseUriFlow.isBusy ||
                  baseURIFrozen ||
                  !baseURIValid
                }
                className="btn-gold mt-4 rounded-xl px-5 py-2.5 text-xs font-semibold uppercase tracking-wide"
              >
                Set base URI
              </button>
              <TxStatus
                phase={baseUriFlow.phase}
                hash={baseUriFlow.hash}
                error={baseUriFlow.error}
                label="Set base URI"
              />
            </div>

            {/* 4. Freeze base URI */}
            <div className="glass rounded-3xl p-7">
              <p className="font-mono text-[11px] uppercase tracking-widest text-amber-200">
                Freeze base URI
              </p>
              <p className="mt-2 font-display text-2xl font-bold text-bone">
                {baseURIFrozen ? "Base URI frozen" : "Lock metadata forever"}
              </p>
              <p className="mt-3 rounded-xl border border-amber-400/60 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                One-way and permanent: once frozen, the base URI can never be
                changed again.
              </p>
              {baseURIFrozen ? (
                <p className="mt-5 text-sm text-muted-grey">
                  Base URI is frozen.
                </p>
              ) : (
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleFreezeClick}
                    disabled={!controlsEnabled || freezeFlow.isBusy}
                    className="rounded-xl border border-amber-400/60 bg-amber-400/10 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-amber-200 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {freezeArmed
                      ? "Click again to confirm freeze"
                      : "Freeze base URI"}
                  </button>
                  {freezeArmed && (
                    <button
                      type="button"
                      onClick={() => setFreezeArmed(false)}
                      disabled={!controlsEnabled || freezeFlow.isBusy}
                      className="btn-ghost rounded-xl px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
              <TxStatus
                phase={freezeFlow.phase}
                hash={freezeFlow.hash}
                error={freezeFlow.error}
                label="Freeze base URI"
              />
            </div>
          </div>

          {/* Metadata status — live reads only, never invented. */}
          <div className="glass rounded-3xl p-7">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-grey">
              Metadata status
            </p>
            <dl className="mt-4 space-y-3 font-mono text-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                <dt className="text-muted-grey">Base URI</dt>
                <dd className="break-all text-bone">
                  {reads.baseURI === undefined
                    ? "DATA UNAVAILABLE"
                    : reads.baseURI === ""
                      ? "Not set"
                      : reads.baseURI}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-grey">Frozen</dt>
                <dd className="text-bone">
                  {reads.baseURIFrozen === undefined
                    ? "DATA UNAVAILABLE"
                    : reads.baseURIFrozen
                      ? "Yes"
                      : "No"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-grey">Paused</dt>
                <dd className="text-bone">
                  {paused === undefined
                    ? "DATA UNAVAILABLE"
                    : paused
                      ? "Yes"
                      : "No"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-grey">Total minted</dt>
                <dd className="text-bone">
                  {reads.totalMinted === undefined
                    ? "DATA UNAVAILABLE"
                    : reads.totalMinted.toString()}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </section>
  );
}
