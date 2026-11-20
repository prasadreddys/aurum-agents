/**
 * Recent contract activity feed (Stage 6) — live events + bounded history.
 *
 * Everything is gated on CONTRACT_DEPLOYED: while the contract is not
 * deployed on BNB Smart Chain Mainnet, no call is made and the caller
 * receives `deployed: false`. The feed renders CONTRACT NOT DEPLOYED and
 * goes live the moment Stage 9 deploys.
 *
 * LIVE: one `useWatchContractEvent` subscription per watched event. On
 * every event the react-query cache is invalidated (same pattern as
 * `useAurumWrites`) so stats / eligibility / ownership refresh without a
 * reload, and the event is prepended to the feed.
 *
 * HISTORY: on mount when deployed, the last 10,000 blocks of past logs
 * are fetched through the wagmi public client (the config's fallback
 * transport: PublicNode first, dataseed second) and decoded with viem
 * `parseEventLogs` against the contract ABI. BNB free public RPCs have
 * been observed to reject eth_getLogs, so a rejection is caught and
 * reported as `historyStatus: "unavailable"` — the feed then shows an
 * honest "history unavailable" note and still works live-forward. History
 * is NEVER faked and an empty feed is NEVER presented as if nothing
 * happened.
 *
 * Events watched (verified against contracts/src/AurumAgents.sol):
 *   FreeMinted, PaidMinted, Withdrawn, BaseURISet, BaseURIFrozen,
 *   Transfer, Paused, Unpaused, OwnershipTransferred.
 * Approval / ApprovalForAll are noise and are deliberately excluded.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Abi, Hash, Log } from "viem";
import { formatEther, parseEventLogs } from "viem";
import {
  CONTRACT_ADDRESS,
  CONTRACT_DEPLOYED,
  ZERO_ADDRESS,
  aurumAgentsAbi,
} from "../config/contract";

const looseAbi = aurumAgentsAbi as unknown as Abi;

/** Past logs are fetched over this many recent blocks — bounded, never "all". */
const HISTORY_BLOCK_RANGE = 10_000n;
/** The feed never shows more than this many entries, newest first. */
const MAX_ENTRIES = 50;

/** Events the feed watches. Approval / ApprovalForAll are excluded as noise. */
const ACTIVITY_EVENT_NAMES = new Set([
  "FreeMinted",
  "PaidMinted",
  "Transfer",
  "Withdrawn",
  "BaseURISet",
  "BaseURIFrozen",
  "Paused",
  "Unpaused",
  "OwnershipTransferred",
]);

export type HistoryStatus = "loading" | "ready" | "unavailable";

export interface ActivityEntry {
  key: string;
  kind: string;
  label: string;
  detail?: string;
  blockNumber: bigint;
  logIndex: number;
  /** Unix seconds, when the block timestamp could be fetched. */
  timestamp?: number;
  transactionHash: Hash;
}

interface DecodedLog {
  eventName: string;
  args: Record<string, unknown>;
  blockNumber: bigint;
  logIndex: number;
  transactionHash: Hash;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function truncateBaseURI(baseURI: string): string {
  return baseURI.length > 48 ? `${baseURI.slice(0, 48)}…` : baseURI;
}

function asAddress(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function asBigInt(value: unknown): bigint {
  return typeof value === "bigint" ? value : 0n;
}

/** Human label + detail for one decoded log. Returns undefined for noise. */
function toEntry(log: DecodedLog): ActivityEntry | undefined {
  const base = {
    key: `${log.transactionHash}-${log.logIndex}`,
    blockNumber: log.blockNumber,
    logIndex: log.logIndex,
    transactionHash: log.transactionHash,
  };
  switch (log.eventName) {
    case "FreeMinted":
      return {
        ...base,
        kind: "FreeMinted",
        label: `Free mint — token #${asBigInt(log.args.tokenId)}`,
        detail: truncateAddress(asAddress(log.args.minter)),
      };
    case "PaidMinted": {
      const price = formatEther(asBigInt(log.args.pricePaid));
      return {
        ...base,
        kind: "PaidMinted",
        label: `Paid mint — token #${asBigInt(log.args.tokenId)} (${price} BNB)`,
        detail: truncateAddress(asAddress(log.args.minter)),
      };
    }
    case "Transfer":
      return {
        ...base,
        kind: "Transfer",
        label: `Transfer — token #${asBigInt(log.args.tokenId)}`,
        detail: `${truncateAddress(asAddress(log.args.from))} → ${truncateAddress(asAddress(log.args.to))}`,
      };
    case "Withdrawn":
      return {
        ...base,
        kind: "Withdrawn",
        label: `Withdrawal — ${formatEther(asBigInt(log.args.amount))} BNB`,
        detail: truncateAddress(asAddress(log.args.to)),
      };
    case "BaseURISet":
      return {
        ...base,
        kind: "BaseURISet",
        label: "Base URI set",
        detail: truncateBaseURI(asAddress(log.args.baseURI)),
      };
    case "BaseURIFrozen":
      return {
        ...base,
        kind: "BaseURIFrozen",
        label: "Base URI frozen",
        detail: truncateBaseURI(asAddress(log.args.baseURI)),
      };
    case "Paused":
      return {
        ...base,
        kind: "Paused",
        label: "Paused",
        detail: truncateAddress(asAddress(log.args.account)),
      };
    case "Unpaused":
      return {
        ...base,
        kind: "Unpaused",
        label: "Unpaused",
        detail: truncateAddress(asAddress(log.args.account)),
      };
    case "OwnershipTransferred":
      return {
        ...base,
        kind: "OwnershipTransferred",
        label: "Ownership transferred",
        detail: `${truncateAddress(asAddress(log.args.previousOwner))} → ${truncateAddress(asAddress(log.args.newOwner))}`,
      };
    default:
      return undefined;
  }
}

/** Merge, dedupe by tx hash + log index, newest first, capped at 50. */
function mergeEntries(
  existing: ActivityEntry[],
  incoming: ActivityEntry[],
): ActivityEntry[] {
  const byKey = new Map(existing.map((e) => [e.key, e]));
  for (const entry of incoming) {
    if (!byKey.has(entry.key)) byKey.set(entry.key, entry);
  }
  return [...byKey.values()]
    .sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return a.blockNumber > b.blockNumber ? -1 : 1;
      }
      return b.logIndex - a.logIndex;
    })
    .slice(0, MAX_ENTRIES);
}

export function useActivityFeed() {
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const [liveEntries, setLiveEntries] = useState<ActivityEntry[]>([]);
  const blockTimeCache = useRef(new Map<bigint, number>());

  /** Block timestamp, cached per block number; undefined when it fails. */
  const fetchBlockTime = useCallback(
    async (blockNumber: bigint): Promise<number | undefined> => {
      const cached = blockTimeCache.current.get(blockNumber);
      if (cached !== undefined) return cached;
      if (!publicClient) return undefined;
      try {
        const block = await publicClient.getBlock({ blockNumber });
        const timestamp = Number(block.timestamp);
        blockTimeCache.current.set(blockNumber, timestamp);
        return timestamp;
      } catch {
        return undefined;
      }
    },
    [publicClient],
  );

  // HISTORY: bounded getLogs over the last 10,000 blocks, once on mount.
  const history = useQuery({
    queryKey: ["activity-history", CONTRACT_ADDRESS],
    enabled: CONTRACT_DEPLOYED && publicClient !== undefined,
    retry: false,
    staleTime: Infinity,
    queryFn: async (): Promise<{
      entries: ActivityEntry[];
      status: "ready" | "unavailable";
    }> => {
      if (!publicClient || !CONTRACT_ADDRESS) {
        return { entries: [], status: "unavailable" };
      }
      try {
        const latest = await publicClient.getBlockNumber();
        const fromBlock =
          latest > HISTORY_BLOCK_RANGE ? latest - HISTORY_BLOCK_RANGE : 0n;
        const logs = await publicClient.getLogs({
          address: CONTRACT_ADDRESS,
          fromBlock,
          toBlock: latest,
        });
        const decoded = parseEventLogs({
          abi: aurumAgentsAbi,
          logs: logs as Log[],
          strict: false,
        }) as unknown as DecodedLog[];
        const entries = decoded
          .filter((log) => ACTIVITY_EVENT_NAMES.has(log.eventName))
          .map(toEntry)
          .filter((e): e is ActivityEntry => e !== undefined);
        // Block timestamps, best effort — a failure leaves the entry
        // showing its block number only.
        const blockNumbers = [...new Set(entries.map((e) => e.blockNumber))];
        const times = await Promise.all(
          blockNumbers.map((bn) => fetchBlockTime(bn)),
        );
        const timeByBlock = new Map(
          blockNumbers.map((bn, i) => [bn, times[i]]),
        );
        for (const entry of entries) {
          const timestamp = timeByBlock.get(entry.blockNumber);
          if (timestamp !== undefined) entry.timestamp = timestamp;
        }
        return { entries, status: "ready" };
      } catch {
        // The RPC rejected the log query (observed on BNB free RPCs).
        // Honest "unavailable" — never fake history, never pretend empty.
        return { entries: [], status: "unavailable" };
      }
    },
  });

  // LIVE: one subscription per watched event. Every event refreshes all
  // reads and is prepended to the feed with its block time when fetchable.
  const handleLiveLogs = useCallback(
    (logs: readonly unknown[]) => {
      void queryClient.invalidateQueries();
      const decoded = parseEventLogs({
        abi: aurumAgentsAbi,
        logs: logs as Log[],
        strict: false,
      }) as unknown as DecodedLog[];
      const fresh = decoded
        .filter((log) => ACTIVITY_EVENT_NAMES.has(log.eventName))
        .map(toEntry)
        .filter((e): e is ActivityEntry => e !== undefined);
      if (fresh.length === 0) return;
      setLiveEntries((prev) => mergeEntries(prev, fresh));
      void (async () => {
        for (const entry of fresh) {
          const timestamp = await fetchBlockTime(entry.blockNumber);
          if (timestamp !== undefined) {
            setLiveEntries((prev) =>
              prev.map((e) =>
                e.key === entry.key ? { ...e, timestamp } : e,
              ),
            );
          }
        }
      })();
    },
    [fetchBlockTime, queryClient],
  );

  const watchArgs = {
    address: CONTRACT_ADDRESS ?? ZERO_ADDRESS,
    abi: looseAbi,
    enabled: CONTRACT_DEPLOYED,
    onLogs: handleLiveLogs,
  } as const;
  useWatchContractEvent({ ...watchArgs, eventName: "FreeMinted" });
  useWatchContractEvent({ ...watchArgs, eventName: "PaidMinted" });
  useWatchContractEvent({ ...watchArgs, eventName: "Transfer" });
  useWatchContractEvent({ ...watchArgs, eventName: "Withdrawn" });
  useWatchContractEvent({ ...watchArgs, eventName: "BaseURISet" });
  useWatchContractEvent({ ...watchArgs, eventName: "BaseURIFrozen" });
  useWatchContractEvent({ ...watchArgs, eventName: "Paused" });
  useWatchContractEvent({ ...watchArgs, eventName: "Unpaused" });
  useWatchContractEvent({ ...watchArgs, eventName: "OwnershipTransferred" });

  const historyStatus: HistoryStatus = !CONTRACT_DEPLOYED
    ? "ready"
    : history.isFetching
      ? "loading"
      : (history.data?.status ?? "loading");

  const entries = useMemo(
    () => mergeEntries(history.data?.entries ?? [], liveEntries),
    // history.data is the stable react-query result object: it only
    // changes identity when the history query actually refetches.
    [history.data, liveEntries],
  );

  return {
    deployed: CONTRACT_DEPLOYED,
    historyStatus,
    entries,
  };
}
