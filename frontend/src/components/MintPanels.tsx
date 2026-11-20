import { useState } from "react";
import { useAccount, useBalance } from "wagmi";
import type { Abi } from "viem";
import { parseEther } from "viem";
import {
  FREE_SUPPLY,
  MAX_FREE_PER_WALLET,
  MAX_PAID_PER_WALLET,
  PAID_PRICE_BNB,
} from "../data/rarity";
import {
  CONTRACT_ADDRESS,
  CONTRACT_DEPLOYED,
  aurumAgentsAbi,
} from "../config/contract";
import {
  useCollectionReads,
  useFreeMintStatus,
  useWalletEligibility,
} from "../hooks/useAurumReads";
import { useContractWrite } from "../hooks/useAurumWrites";
import TxStatus from "./TxStatus";

/** Same widening as the read hooks: the ABI is `as const`, writes use it as generic `Abi`. */
const looseAbi = aurumAgentsAbi as unknown as Abi;

/**
 * Minting dashboard (Stage 5: mint flow wired).
 *
 * Free and paid mints call the contract on BSC Mainnet (chain 56) — but
 * only once it is deployed (Stage 9) and the user clicks a mint button in
 * their own browser. Until then every button is disabled and every
 * not-yet-live value shows CONTRACT NOT DEPLOYED / CONNECT WALLET.
 * No transaction is ever signed here except from a mint-button click, and
 * the app never switches networks on its own.
 */
export default function MintPanels() {
  const { address, isConnected, chainId } = useAccount();
  const onBsc = chainId === 56;

  const { data: balance } = useBalance({
    address,
    chainId: 56,
    query: { enabled: isConnected && onBsc },
  });

  const { paused } = useCollectionReads();
  const freeStatus = useFreeMintStatus(address);
  const eligibility = useWalletEligibility(address);

  const freeTx = useContractWrite();
  const paidTx = useContractWrite();

  /* ---------------- free mint ---------------- */

  const freeRemaining = freeStatus.remainingFree;
  const freeSoldOut =
    CONTRACT_DEPLOYED && freeRemaining !== undefined && freeRemaining === 0n;

  const freeCanMint =
    CONTRACT_DEPLOYED &&
    isConnected &&
    onBsc &&
    !paused &&
    freeStatus.isEligible === true &&
    !freeTx.isBusy;

  function freeDisabledReason(): string | undefined {
    if (!CONTRACT_DEPLOYED) {
      return isConnected
        ? "Disabled — contract not deployed. Once the 1,111 free NFTs sell out, this panel shows FREE MINT SOLD OUT."
        : "Disabled — contract not deployed. Connect a wallet to mint.";
    }
    if (!isConnected) return "Connect a wallet to mint.";
    if (!onBsc) return "Switch to BSC Mainnet (chain 56)";
    if (paused) return "Minting is paused";
    if (freeSoldOut) return "Free mint sold out";
    if (freeStatus.hasClaimedFree) return "You already claimed your free NFT";
    if (freeStatus.isEligible === false) return "Not eligible for a free mint.";
    return undefined;
  }

  function handleFreeMint() {
    if (!CONTRACT_ADDRESS || !freeCanMint) return;
    freeTx.write({
      address: CONTRACT_ADDRESS,
      abi: looseAbi,
      functionName: "freeMint",
      args: [],
    });
  }

  /* ---------------- paid mint ---------------- */

  const remainingPaidNum =
    eligibility.paidMintRemaining !== undefined
      ? Number(eligibility.paidMintRemaining)
      : undefined;
  const maxQty = Math.min(
    MAX_PAID_PER_WALLET,
    remainingPaidNum ?? MAX_PAID_PER_WALLET,
  );
  const paidLimitReached = remainingPaidNum === 0;

  const [qty, setQty] = useState(3);
  // Derived during render (not synced in an effect): the stored qty can
  // exceed the live cap after a mint lowers the remaining allowance.
  const effectiveQty = Math.min(Math.max(1, qty), Math.max(1, maxQty));

  const total = (effectiveQty * PAID_PRICE_BNB).toFixed(3);
  const value = parseEther(total);
  const insufficient =
    balance !== undefined && balance.value < value;

  const paidCanMint =
    CONTRACT_DEPLOYED &&
    isConnected &&
    onBsc &&
    !paused &&
    (remainingPaidNum ?? 0) > 0 &&
    balance !== undefined &&
    !insufficient &&
    !paidTx.isBusy;

  function paidDisabledReason(): string | undefined {
    if (!CONTRACT_DEPLOYED) {
      return isConnected
        ? "Disabled — contract not deployed."
        : "Disabled — contract not deployed. Connect a wallet to mint.";
    }
    if (!isConnected) return "Connect a wallet to mint.";
    if (!onBsc) return "Switch to BSC Mainnet (chain 56)";
    if (paused) return "Minting is paused";
    if (paidLimitReached) return "Paid mint sold out";
    if (insufficient)
      return `Insufficient BNB — you need ${total} BNB plus gas.`;
    return undefined;
  }

  function handlePaidMint() {
    if (!CONTRACT_ADDRESS || !paidCanMint) return;
    paidTx.write({
      address: CONTRACT_ADDRESS,
      abi: looseAbi,
      functionName: "paidMint",
      args: [BigInt(effectiveQty)],
      value,
    });
  }

  const zeroBnb =
    isConnected && onBsc && balance !== undefined && balance.value === 0n;

  return (
    <section id="mint" className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
      <div className="mb-8">
        <h2 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
          Mint <span className="text-gold-gradient">dashboard</span>
        </h2>
        <p className="mt-2 max-w-2xl text-muted-grey">
          Free and paid mints are enforced in the smart contract (1 free and
          max 10 paid per wallet, 11 combined). Minting is wired on-chain —
          it runs here once the contract is deployed and a wallet is
          connected on BSC Mainnet.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Free mint panel */}
        <div className="glass rounded-3xl p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-visor-emerald">
                Free mint
              </p>
              <p className="mt-2 font-display text-4xl font-bold text-bone">FREE</p>
              <p className="mt-1 text-sm text-muted-grey">
                0 BNB · limit {MAX_FREE_PER_WALLET} per wallet
              </p>
            </div>
            <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-emerald-300">
              {FREE_SUPPLY.toLocaleString()} allocation
            </span>
          </div>

          <dl className="mt-6 space-y-2 border-t border-white/5 pt-5 font-mono text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-grey">Free remaining</dt>
              <dd className="text-amber-200">
                {!CONTRACT_DEPLOYED
                  ? "CONTRACT NOT DEPLOYED"
                  : freeRemaining !== undefined
                    ? freeRemaining.toLocaleString()
                    : "…"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-grey">Your eligibility</dt>
              <dd className="text-bone">
                {!isConnected
                  ? "CONNECT WALLET"
                  : !CONTRACT_DEPLOYED
                    ? "CONTRACT NOT DEPLOYED"
                    : freeStatus.isEligible === true
                      ? "Eligible"
                      : freeStatus.hasClaimedFree
                        ? "Already claimed"
                        : freeSoldOut
                          ? "Sold out"
                          : freeStatus.isEligible === false
                            ? "Not eligible"
                            : "…"}
              </dd>
            </div>
          </dl>

          <button
            type="button"
            disabled={!freeCanMint}
            onClick={handleFreeMint}
            className="btn-gold mt-7 w-full rounded-xl px-6 py-3.5 text-sm uppercase tracking-wide"
          >
            Claim free NFT
          </button>
          {freeDisabledReason() !== undefined && (
            <p className="mt-3 text-center text-xs text-muted-grey">
              {freeDisabledReason()}
            </p>
          )}
          {zeroBnb && (
            <p className="mt-3 text-center text-xs text-muted-grey">
              Your wallet holds 0 BNB — you need a small amount of BNB for
              gas.
            </p>
          )}
          <TxStatus
            phase={freeTx.phase}
            hash={freeTx.hash}
            error={freeTx.error}
            label="Free mint"
          />
          {freeTx.phase === "confirmed" && (
            <button
              type="button"
              onClick={freeTx.reset}
              className="btn-ghost mx-auto mt-3 block rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wide"
            >
              Dismiss
            </button>
          )}
        </div>

        {/* Paid mint panel */}
        <div className="glass rounded-3xl p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-aurum-gold">
                Paid mint
              </p>
              <p className="mt-2 font-display text-4xl font-bold text-bone">
                {PAID_PRICE_BNB} BNB
                <span className="ml-2 text-lg font-medium text-muted-grey">/ NFT</span>
              </p>
              <p className="mt-1 text-sm text-muted-grey">
                Quantity 1–{MAX_PAID_PER_WALLET} · max {MAX_PAID_PER_WALLET} per wallet
              </p>
            </div>
            <span className="rounded-full border border-antique-gold/40 bg-antique-gold/10 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-bright-gold">
              4,444 allocation
            </span>
          </div>

          <div className="mt-6 border-t border-white/5 pt-5">
            <label htmlFor="qty" className="font-mono text-xs uppercase tracking-widest text-muted-grey">
              Quantity
            </label>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={paidLimitReached}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="btn-ghost h-11 w-11 rounded-xl font-display text-xl font-bold"
              >
                −
              </button>
              <div className="flex h-11 flex-1 items-center justify-center rounded-xl border border-antique-gold/30 bg-black/40 font-display text-2xl font-bold">
                {effectiveQty}
              </div>
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={paidLimitReached}
                onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                className="btn-ghost h-11 w-11 rounded-xl font-display text-xl font-bold"
              >
                +
              </button>
            </div>
            <input
              id="qty"
              type="range"
              min={1}
              max={Math.max(1, maxQty)}
              value={effectiveQty}
              disabled={paidLimitReached}
              onChange={(e) => setQty(Number(e.target.value))}
              className="mt-4 w-full accent-[#ffd700]"
            />
            <div className="mt-2 flex justify-between font-mono text-sm">
              <span className="text-muted-grey">Total</span>
              <span className="font-bold text-aurum-gold">{total} BNB</span>
            </div>
            <p className="mt-1 font-mono text-xs text-muted-grey">
              {effectiveQty} × {PAID_PRICE_BNB} BNB = {total} BNB (exact value; gas extra)
            </p>
            {paidLimitReached && (
              <p className="mt-2 font-mono text-xs text-amber-200">
                You have reached the 10 paid mint limit for this wallet.
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={!paidCanMint}
            onClick={handlePaidMint}
            className="btn-gold mt-6 w-full rounded-xl px-6 py-3.5 text-sm uppercase tracking-wide"
          >
            Mint {effectiveQty} NFT{effectiveQty > 1 ? "s" : ""} — {total} BNB
          </button>
          {paidDisabledReason() !== undefined && (
            <p className="mt-3 text-center text-xs text-muted-grey">
              {paidDisabledReason()}
            </p>
          )}
          <TxStatus
            phase={paidTx.phase}
            hash={paidTx.hash}
            error={paidTx.error}
            label="Paid mint"
          />
          {paidTx.phase === "confirmed" && (
            <button
              type="button"
              onClick={paidTx.reset}
              className="btn-ghost mx-auto mt-3 block rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wide"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
