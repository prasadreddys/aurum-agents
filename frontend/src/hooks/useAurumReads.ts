/**
 * Live contract reads (Stage 4) via wagmi `useReadContract` / viem.
 *
 * Every hook is gated on CONTRACT_DEPLOYED: while the contract is not
 * deployed on BNB Smart Chain Mainnet, no call is made and the caller
 * receives `deployed: false`. Callers must render CONTRACT NOT DEPLOYED —
 * never a fabricated number.
 *
 * Prompt mapping (Stage 1 research §1.5, prompt center):
 *   #2 free-mint check  -> useFreeMintStatus(address)
 *   #5 NFT balance      -> useOwnedTokenIds(address)
 *   #6 collection status-> useCollectionReads()
 *   #8 wallet eligibility -> useWalletEligibility(address)
 *   #9 collection details -> useCollectionReads() + constants
 *   #7 tx status        -> useTxReceipt(hash) via the BSC public RPC
 */
import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import type { Abi, Address, Hash } from "viem";
import { createPublicClient, http } from "viem";
import { bsc } from "viem/chains";
import { useQuery } from "@tanstack/react-query";
import {
  CONTRACT_ADDRESS,
  CONTRACT_DEPLOYED,
  ZERO_ADDRESS,
  aurumAgentsAbi,
} from "../config/contract";
import { BSC_RPC_URL } from "../config/env";

export const NOT_DEPLOYED = "CONTRACT NOT DEPLOYED";

/**
 * The ABI is kept `as const` in config/contract.ts so its literal shape is
 * preserved for tooling, but wagmi's typed hooks require literal function
 * names when given a narrow ABI. The read hooks below address functions by
 * plain string names, so they use the ABI widened to viem's generic `Abi`
 * type. The contract's own ABI is unchanged — only the local type view.
 */
const looseAbi = aurumAgentsAbi as unknown as Abi;

/** Read-only BSC client for receipt lookups (prompt #7). No key needed. */
const bscPublicClient = createPublicClient({
  chain: bsc,
  transport: http(BSC_RPC_URL),
});

function contractCall(
  functionName: string,
  args: readonly unknown[] = [],
) {
  return {
    address: CONTRACT_ADDRESS ?? ZERO_ADDRESS,
    abi: looseAbi,
    functionName,
    args,
  } as const;
}

export interface CollectionReads {
  deployed: boolean;
  isLoading: boolean;
  isError: boolean;
  totalMinted?: bigint;
  totalSupply?: bigint;
  freeMinted?: bigint;
  paidMinted?: bigint;
  remainingFree?: bigint;
  remainingPaid?: bigint;
  remainingSupply?: bigint;
  paused?: boolean;
  owner?: Address;
  baseURI?: string;
  baseURIFrozen?: boolean;
}

/** Collection-wide supply / status reads — prompt #6 and #9. */
export function useCollectionReads(): CollectionReads {
  const r = useReadContracts({
    contracts: [
      { ...contractCall("totalMinted") },
      { ...contractCall("totalSupply") },
      { ...contractCall("freeMinted") },
      { ...contractCall("paidMinted") },
      { ...contractCall("remainingFree") },
      { ...contractCall("remainingPaid") },
      { ...contractCall("remainingSupply") },
      { ...contractCall("paused") },
      { ...contractCall("owner") },
      { ...contractCall("baseURI") },
      { ...contractCall("baseURIFrozen") },
    ],
    query: { enabled: CONTRACT_DEPLOYED },
  });
  const d = r.data;
  return {
    deployed: CONTRACT_DEPLOYED,
    isLoading: r.isLoading,
    isError: r.isError,
    totalMinted: d?.[0]?.result as bigint | undefined,
    totalSupply: d?.[1]?.result as bigint | undefined,
    freeMinted: d?.[2]?.result as bigint | undefined,
    paidMinted: d?.[3]?.result as bigint | undefined,
    remainingFree: d?.[4]?.result as bigint | undefined,
    remainingPaid: d?.[5]?.result as bigint | undefined,
    remainingSupply: d?.[6]?.result as bigint | undefined,
    paused: d?.[7]?.result as boolean | undefined,
    owner: d?.[8]?.result as Address | undefined,
    baseURI: d?.[9]?.result as string | undefined,
    baseURIFrozen: d?.[10]?.result as boolean | undefined,
  };
}

export interface FreeMintStatus {
  deployed: boolean;
  connected: boolean;
  isLoading: boolean;
  hasClaimedFree?: boolean;
  remainingFree?: bigint;
  isEligible?: boolean;
}

/** Free-mint check for one wallet — prompt #2. */
export function useFreeMintStatus(
  address: Address | undefined,
): FreeMintStatus {
  const enabled = CONTRACT_DEPLOYED && address !== undefined;
  const claimed = useReadContract({
    ...contractCall("hasClaimedFree", address ? [address] : [ZERO_ADDRESS]),
    query: { enabled },
  });
  const remaining = useReadContract({
    ...contractCall("remainingFree"),
    query: { enabled },
  });
  const eligible = useReadContract({
    ...contractCall("isFreeMintEligible", address ? [address] : [ZERO_ADDRESS]),
    query: { enabled },
  });
  return {
    deployed: CONTRACT_DEPLOYED,
    connected: address !== undefined,
    isLoading: claimed.isLoading || remaining.isLoading || eligible.isLoading,
    hasClaimedFree: claimed.data as boolean | undefined,
    remainingFree: remaining.data as bigint | undefined,
    isEligible: eligible.data as boolean | undefined,
  };
}

export interface WalletEligibility {
  deployed: boolean;
  connected: boolean;
  isLoading: boolean;
  hasClaimedFree?: boolean;
  paidMintedBy?: bigint;
  paidMintRemaining?: bigint;
  isFreeMintEligible?: boolean;
}

/** Wallet eligibility + paid allowance — prompt #8. */
export function useWalletEligibility(
  address: Address | undefined,
): WalletEligibility {
  const enabled = CONTRACT_DEPLOYED && address !== undefined;
  const a = address ?? ZERO_ADDRESS;
  const claimed = useReadContract({
    ...contractCall("hasClaimedFree", [a]),
    query: { enabled },
  });
  const paidBy = useReadContract({
    ...contractCall("paidMintedBy", [a]),
    query: { enabled },
  });
  const paidLeft = useReadContract({
    ...contractCall("paidMintRemaining", [a]),
    query: { enabled },
  });
  const eligible = useReadContract({
    ...contractCall("isFreeMintEligible", [a]),
    query: { enabled },
  });
  return {
    deployed: CONTRACT_DEPLOYED,
    connected: address !== undefined,
    isLoading:
      claimed.isLoading ||
      paidBy.isLoading ||
      paidLeft.isLoading ||
      eligible.isLoading,
    hasClaimedFree: claimed.data as boolean | undefined,
    paidMintedBy: paidBy.data as bigint | undefined,
    paidMintRemaining: paidLeft.data as bigint | undefined,
    isFreeMintEligible: eligible.data as boolean | undefined,
  };
}

export interface OwnedTokens {
  deployed: boolean;
  connected: boolean;
  isLoading: boolean;
  balance?: bigint;
  tokenIds: bigint[];
}

/**
 * Owned token IDs for one wallet — prompt #5. Enumerates via
 * ERC721Enumerable `tokenOfOwnerByIndex`, capped at 100 calls so a wallet
 * holding transferred tokens cannot trigger an unbounded read fan-out.
 */
export function useOwnedTokenIds(address: Address | undefined): OwnedTokens {
  const balance = useReadContract({
    ...contractCall("balanceOf", address ? [address] : [ZERO_ADDRESS]),
    query: { enabled: CONTRACT_DEPLOYED && address !== undefined },
  });
  const count = balance.data !== undefined ? Number(balance.data) : 0;
  const capped = Math.min(count, 100);
  const tokens = useReadContracts({
    contracts: Array.from({ length: capped }, (_, i) => ({
      ...contractCall("tokenOfOwnerByIndex", [address ?? ZERO_ADDRESS, BigInt(i)]),
    })),
    query: { enabled: CONTRACT_DEPLOYED && address !== undefined && capped > 0 },
  });
  const tokenIds = useMemo(
    () =>
      (tokens.data ?? [])
        .map((r) => r.result as bigint | undefined)
        .filter((v): v is bigint => v !== undefined),
    [tokens.data],
  );
  return {
    deployed: CONTRACT_DEPLOYED,
    connected: address !== undefined,
    isLoading: balance.isLoading || tokens.isLoading,
    balance: balance.data as bigint | undefined,
    tokenIds,
  };
}

export interface TxReceiptState {
  status: "idle" | "loading" | "found" | "pending" | "not-found" | "error";
  txStatus?: "success" | "reverted";
  blockNumber?: bigint;
  from?: Address;
  to?: Address | null;
  error?: string;
}

/**
 * Transaction receipt lookup by hash — prompt #7. Reads the receipt from
 * the BSC public RPC (no key) and links out to BscScan. This is a generic
 * lookup of any transaction hash; with no contract deployed there are no
 * mint transactions to look up, so the panel says so honestly.
 */
export function useTxReceipt(hash: string | undefined) {
  const clean =
    hash !== undefined && /^0x[0-9a-fA-F]{64}$/.test(hash.trim())
      ? (hash.trim() as Hash)
      : undefined;
  const q = useQuery({
    queryKey: ["tx-receipt", clean],
    enabled: clean !== undefined,
    queryFn: async (): Promise<TxReceiptState> => {
      if (!clean) return { status: "idle" };
      try {
        const [receipt, tx] = await Promise.all([
          bscPublicClient.getTransactionReceipt({ hash: clean }),
          bscPublicClient.getTransaction({ hash: clean }),
        ]);
        return {
          status: "found",
          txStatus: receipt.status,
          blockNumber: receipt.blockNumber,
          from: tx.from,
          to: tx.to,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (/not found|notFound|TransactionNotFound/i.test(message)) {
          return { status: "not-found" };
        }
        // A receipt that does not exist yet (tx still pending) surfaces as
        // a "not found" from most RPCs; distinguish by checking the tx.
        try {
          const tx = await bscPublicClient.getTransaction({ hash: clean });
          return { status: "pending", from: tx.from, to: tx.to };
        } catch {
          return { status: "error", error: message };
        }
      }
    },
    staleTime: 30_000,
  });
  return {
    hash: clean,
    isValidFormat: hash === undefined || hash.trim() === "" || clean !== undefined,
    isLoading: q.isFetching,
    state: (q.data ?? { status: "idle" }) as TxReceiptState,
  };
}
