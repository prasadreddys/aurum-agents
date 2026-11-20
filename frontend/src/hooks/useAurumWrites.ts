/**
 * Contract write flow (Stage 5) — freeMint / paidMint via wagmi.
 *
 * One `useContractWrite` instance tracks a single mint transaction from
 * wallet confirmation through on-chain receipt. Nothing is ever signed
 * except when the user explicitly clicks a mint button in their own
 * browser; this hook only exposes the write function to the panels.
 *
 * Phase derivation:
 *   idle      — no hash, wallet not confirming, no error
 *   awaiting  — useWriteContract isPending (wallet confirmation open)
 *   pending   — hash exists, receipt still loading
 *   confirmed — receipt status is "success"
 *   failed    — write error, or receipt status is "reverted"
 *
 * On a successful receipt every react-query query is invalidated so the
 * post-mint reads (eligibility, remaining supply, balances) refresh.
 */
import { useEffect } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";

export type TxPhase = "idle" | "awaiting" | "pending" | "confirmed" | "failed";

/**
 * One write flow. Derived from the hook's own return type (rather than
 * annotated with wagmi's generic overloads) because the app registers a
 * typed wagmi config, and the registered-config mutate type does not
 * match the generic `ReturnType<typeof useWriteContract>` overload.
 */

/** Prefer wagmi's shortMessage, else the plain message, capped at 240 chars. */
function toErrorMessage(error: unknown): string | undefined {
  if (!error) return undefined;
  const err = error as Error & { shortMessage?: string };
  const message = err.shortMessage ?? err.message ?? String(error);
  return message.length > 240 ? message.slice(0, 240) : message;
}

export function useContractWrite() {
  const queryClient = useQueryClient();
  const writeState = useWriteContract();
  const hash = writeState.data;
  const receipt = useWaitForTransactionReceipt({ hash });

  const writeError = toErrorMessage(writeState.error);
  // NOTE: receipt.status is the react-query status ("pending" | "success"
  // | "error"); the transaction outcome lives on receipt.data.status
  // ("success" | "reverted").
  const receiptStatus = receipt.data?.status;
  const receiptReverted = receiptStatus === "reverted";
  const receiptSuccess = receiptStatus === "success";
  const error =
    writeError ?? (receiptReverted ? "Transaction reverted." : undefined);

  const phase: TxPhase =
    error !== undefined
      ? "failed"
      : receiptSuccess
        ? "confirmed"
        : hash !== undefined
          ? "pending"
          : writeState.isPending
            ? "awaiting"
            : "idle";

  // Refresh every read once the mint lands on-chain.
  useEffect(() => {
    if (receiptSuccess) {
      void queryClient.invalidateQueries();
    }
  }, [receiptSuccess, queryClient]);

  return {
    phase,
    hash,
    error,
    /** True while awaiting wallet confirmation or while the tx is pending. */
    isBusy: phase === "awaiting" || phase === "pending",
    write: writeState.writeContract,
    reset: writeState.reset,
  };
}

export type TxFlow = ReturnType<typeof useContractWrite>;
