/**
 * Live contract checks (Stage 4) — the prompt center's read prompts wired
 * to real on-chain reads via wagmi/viem.
 *
 * Prompts 2, 5, 6, 8 and 9 read the AurumAgents contract; prompt 7 looks
 * up a transaction receipt on the BSC public RPC. Prompt 10 is guidance
 * only and has no on-chain read.
 *
 * THE CONTRACT IS NOT DEPLOYED. Until Stage 9 sets VITE_CONTRACT_ADDRESS,
 * every contract-backed row shows CONTRACT NOT DEPLOYED — never a
 * fabricated number. Wallet-specific rows show CONNECT WALLET until a
 * wallet is connected. The copy-paste prompt cards below are unchanged.
 */
import { useState } from "react";
import { useAccount } from "wagmi";
import {
  NOT_DEPLOYED,
  useCollectionReads,
  useFreeMintStatus,
  useOwnedTokenIds,
  useTxReceipt,
  useWalletEligibility,
} from "../hooks/useAurumReads";
import { CONTRACT_ADDRESS, CONTRACT_DEPLOYED } from "../config/contract";
import { bscScanAddressUrl, bscScanTxUrl } from "../config/contract";

function fmt(value: bigint | undefined): string {
  return value === undefined ? "…" : value.toLocaleString();
}

function Row({
  id,
  title,
  children,
}: {
  id: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-black/30 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-widest text-aurum-gold">
          Prompt {String(id).padStart(2, "0")} · live check
        </p>
        <p className="mt-0.5 font-display font-bold text-bone">{title}</p>
      </div>
      <div className="text-sm text-bone/90 sm:text-right">{children}</div>
    </div>
  );
}

function NotDeployed() {
  return <span className="font-mono text-xs text-amber-200">{NOT_DEPLOYED}</span>;
}

export default function LiveChecks() {
  const { address, isConnected } = useAccount();
  const collection = useCollectionReads();
  const freeMint = useFreeMintStatus(address);
  const owned = useOwnedTokenIds(address);
  const eligibility = useWalletEligibility(address);

  const [txInput, setTxInput] = useState("");
  const [txSubmitted, setTxSubmitted] = useState<string | undefined>(undefined);
  const tx = useTxReceipt(txSubmitted);

  const loading = collection.isLoading;

  return (
    <div className="mb-8 rounded-3xl border border-antique-gold/30 bg-black/20 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-xl font-bold uppercase tracking-tight">
          Live checks <span className="text-gold-gradient">— on-chain reads</span>
        </h3>
        {CONTRACT_DEPLOYED ? (
          <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-emerald-200">
            ◆ Live on BSC Mainnet
          </span>
        ) : (
          <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-amber-200">
            ◆ Contract not deployed
          </span>
        )}
      </div>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-grey">
        These are the read prompts (2, 5, 6, 7, 8, 9) executed live against
        the AurumAgents contract on BNB Smart Chain Mainnet.{" "}
        {CONTRACT_DEPLOYED ? (
          <>Values read live from the chain — never invented.</>
        ) : (
          <>
            The contract is not deployed yet, so every contract value honestly
            reads{" "}
            <span className="font-mono text-amber-200">
              CONTRACT NOT DEPLOYED
            </span>{" "}
            until Stage 9.
          </>
        )}{" "}
        The transaction lookup (#7) reads the BSC public RPC directly and
        works for any transaction hash.
      </p>

      <div className="mt-5 space-y-3">
        <Row id={2} title="Check free mint">
          {!isConnected ? (
            <span className="font-mono text-xs text-bone">CONNECT WALLET</span>
          ) : !freeMint.deployed ? (
            <NotDeployed />
          ) : freeMint.isLoading ? (
            <span className="font-mono text-xs">Reading…</span>
          ) : (
            <>
              <span className="font-mono">{fmt(freeMint.remainingFree)}</span>{" "}
              of 1,111 free NFTs remain
              <br />
              <span className="text-muted-grey">
                {freeMint.hasClaimedFree
                  ? "Your wallet has already claimed its free NFT."
                  : "Your wallet has not claimed its free NFT."}
              </span>
            </>
          )}
        </Row>

        <Row id={5} title="Check NFT balance">
          {!isConnected ? (
            <span className="font-mono text-xs text-bone">CONNECT WALLET</span>
          ) : !owned.deployed ? (
            <NotDeployed />
          ) : owned.isLoading ? (
            <span className="font-mono text-xs">Reading…</span>
          ) : (
            <>
              Balance:{" "}
              <span className="font-mono">{fmt(owned.balance)}</span> NFT
              {(owned.balance ?? 0n) !== 1n ? "s" : ""}
              {owned.tokenIds.length > 0 && (
                <>
                  <br />
                  <span className="text-muted-grey">
                    Token IDs:{" "}
                    {owned.tokenIds.slice(0, 11).map((t) => `#${t}`).join(", ")}
                    {owned.tokenIds.length > 11 &&
                      ` +${owned.tokenIds.length - 11} more`}
                  </span>
                </>
              )}
            </>
          )}
        </Row>

        <Row id={6} title="Collection status">
          {!collection.deployed ? (
            <NotDeployed />
          ) : loading ? (
            <span className="font-mono text-xs">Reading…</span>
          ) : (
            <>
              Total minted:{" "}
              <span className="font-mono">{fmt(collection.totalMinted)}</span> /{" "}
              {fmt(collection.totalSupply)}
              <br />
              Free: <span className="font-mono">{fmt(collection.freeMinted)}</span>{" "}
              minted ·{" "}
              <span className="font-mono">{fmt(collection.remainingFree)}</span>{" "}
              remaining
              <br />
              Paid: <span className="font-mono">{fmt(collection.paidMinted)}</span>{" "}
              minted ·{" "}
              <span className="font-mono">{fmt(collection.remainingPaid)}</span>{" "}
              remaining
              <br />
              <span className="text-muted-grey">
                {collection.paused ? "Minting is paused." : "Minting is live."}
              </span>
            </>
          )}
        </Row>

        <Row id={7} title="Transaction status">
          <form
            className="flex flex-col items-stretch gap-2 sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              setTxSubmitted(txInput.trim() || undefined);
            }}
          >
            <input
              type="text"
              value={txInput}
              onChange={(e) => setTxInput(e.target.value)}
              placeholder="0x transaction hash"
              spellCheck={false}
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 font-mono text-xs text-bone placeholder:text-muted-grey sm:w-96"
            />
            <button
              type="submit"
              className="btn-ghost rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wide"
            >
              Check on BscScan
            </button>
          </form>
          {txSubmitted !== undefined && (
            <div className="mt-2 text-xs leading-relaxed">
              {!tx.isValidFormat ? (
                <span className="text-red-200">
                  Invalid hash — a transaction hash is 0x followed by 64 hex
                  characters.
                </span>
              ) : tx.isLoading ? (
                <span className="font-mono">Reading…</span>
              ) : tx.state.status === "found" ? (
                <>
                  <span
                    className={
                      tx.state.txStatus === "success"
                        ? "text-emerald-300"
                        : "text-red-200"
                    }
                  >
                    {tx.state.txStatus === "success"
                      ? "✓ Confirmed"
                      : "✗ Reverted"}
                  </span>{" "}
                  · block{" "}
                  <span className="font-mono">
                    {tx.state.blockNumber?.toString()}
                  </span>{" "}
                  ·{" "}
                  <a
                    className="text-aurum-gold underline"
                    href={bscScanTxUrl(txSubmitted)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    BscScan ↗
                  </a>
                </>
              ) : tx.state.status === "pending" ? (
                <span className="text-amber-200">
                  Transaction found but no receipt yet — still pending.
                </span>
              ) : tx.state.status === "not-found" ? (
                <span className="text-muted-grey">
                  No transaction with this hash on BNB Smart Chain.
                </span>
              ) : tx.state.status === "error" ? (
                <span className="text-red-200">
                  Lookup failed: {tx.state.error ?? "RPC error"}
                </span>
              ) : null}
              <p className="mt-1 text-muted-grey">
                {CONTRACT_DEPLOYED
                  ? "Mint transactions exist on-chain — look one up by hash above."
                  : "No mint transactions exist yet — the contract is not deployed."}
              </p>
            </div>
          )}
        </Row>

        <Row id={8} title="Wallet eligibility">
          {!isConnected ? (
            <span className="font-mono text-xs text-bone">CONNECT WALLET</span>
          ) : !eligibility.deployed ? (
            <NotDeployed />
          ) : eligibility.isLoading ? (
            <span className="font-mono text-xs">Reading…</span>
          ) : (
            <>
              Free mint:{" "}
              {eligibility.isFreeMintEligible
                ? "eligible"
                : eligibility.hasClaimedFree
                  ? "already claimed"
                  : "not eligible"}
              <br />
              Paid allowance left:{" "}
              <span className="font-mono">
                {fmt(eligibility.paidMintRemaining)}
              </span>{" "}
              of 10
            </>
          )}
        </Row>

        <Row id={9} title="Collection details">
          {!collection.deployed ? (
            <NotDeployed />
          ) : (
            <>
              Contract:{" "}
              <a
                className="font-mono text-aurum-gold underline"
                href={bscScanAddressUrl(CONTRACT_ADDRESS as string)}
                target="_blank"
                rel="noreferrer"
              >
                {CONTRACT_ADDRESS}
              </a>
              <br />
              Standard: ERC-721 · Supply: 5,555 · Paid: 0.001 BNB
              <br />
              <span className="text-muted-grey">
                Metadata: {collection.baseURI ?? "—"}
              </span>
            </>
          )}
        </Row>

        <Row id={10} title="Help">
          <span className="text-muted-grey">
            No on-chain read — guidance only. See the Help prompt card below.
          </span>
        </Row>
      </div>
    </div>
  );
}
