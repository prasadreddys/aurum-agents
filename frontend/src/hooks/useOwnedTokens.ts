/**
 * Owned-token metadata (Stage 5) for the "My NFTs" view.
 *
 * Read-only: this hook never signs anything. Token IDs come only from the
 * on-chain enumeration in `useOwnedTokenIds` (balanceOf +
 * tokenOfOwnerByIndex, capped at 100) — no ID is ever invented or taken
 * from the local gallery index. The local index is used only to attach
 * rarity/traits to IDs the chain already proved the wallet owns.
 *
 * While the contract is not deployed (CONTRACT_DEPLOYED is false) no
 * contract call is made and the caller receives `deployed: false`.
 * Callers must render CONTRACT NOT DEPLOYED — never a fabricated number.
 *
 * Metadata resolution per token, in order:
 *   1. tokenURI(tokenId) read on-chain.
 *   2. The tokenURI JSON fetched (8 s timeout). Any fetch/parse failure
 *      leaves `metadata` undefined — it never throws.
 *   3. The local /gallery-index.json entry for the same numeric ID, as
 *      `local` (rarity/traits). `metadataSource` is "on-chain" only when
 *      step 2 actually returned metadata; otherwise it is "local".
 */
import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import type { Abi, Address } from "viem";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  CONTRACT_ADDRESS,
  CONTRACT_DEPLOYED,
  ZERO_ADDRESS,
  aurumAgentsAbi,
} from "../config/contract";
import { useOwnedTokenIds } from "./useAurumReads";
import type { GalleryToken } from "../data/rarity";

/**
 * The ABI is kept `as const` in config/contract.ts, but wagmi's typed
 * hooks require literal function names when given a narrow ABI. The read
 * below addresses the function by plain string name, so it uses the ABI
 * widened to viem's generic `Abi` type — the same `looseAbi` pattern as
 * useAurumReads.ts. The contract's own ABI is unchanged.
 */
const looseAbi = aurumAgentsAbi as unknown as Abi;

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

export interface OwnedTokenMetadata {
  name?: string;
  image?: string;
  description?: string;
}

export interface OwnedTokenMeta {
  id: bigint;
  tokenURI: string | undefined;
  metadata: OwnedTokenMetadata | undefined;
  metadataSource: "on-chain" | "local";
  local: GalleryToken | undefined; // rarity/traits from the local gallery index, if known
}

export interface OwnedTokensMeta {
  deployed: boolean;
  connected: boolean;
  isLoading: boolean;
  balance: bigint | undefined;
  tokens: OwnedTokenMeta[];
}

/** Cap mirrors useOwnedTokenIds: at most 100 owned tokens are enumerated. */
const MAX_OWNED_TOKENS = 100;

/** Fetch one tokenURI JSON. Any failure returns undefined — never throws. */
async function fetchTokenMetadata(
  tokenURI: string,
): Promise<OwnedTokenMetadata | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(tokenURI, { signal: controller.signal });
    if (!res.ok) return undefined;
    const data: unknown = await res.json();
    if (data === null || typeof data !== "object") return undefined;
    const record = data as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name : undefined;
    const image =
      typeof record.image === "string" ? record.image : undefined;
    const description =
      typeof record.description === "string"
        ? record.description
        : undefined;
    // A JSON document with none of the expected fields is not usable metadata.
    if (name === undefined && image === undefined && description === undefined) {
      return undefined;
    }
    return { name, image, description };
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch the local gallery index once. Any failure returns undefined — never throws. */
async function fetchGalleryIndex(): Promise<GalleryToken[] | undefined> {
  try {
    const res = await fetch("/gallery-index.json");
    if (!res.ok) return undefined;
    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as GalleryToken[]) : undefined;
  } catch {
    return undefined;
  }
}

export function useOwnedTokensMeta(
  address: Address | undefined,
): OwnedTokensMeta {
  const owned = useOwnedTokenIds(address);
  const tokenIds = useMemo(
    () => owned.tokenIds.slice(0, MAX_OWNED_TOKENS),
    [owned.tokenIds],
  );

  // tokenURI per owned token — same pattern as useOwnedTokenIds.
  const uriReads = useReadContracts({
    contracts: tokenIds.map((id) => ({
      ...contractCall("tokenURI", [id]),
    })),
    query: {
      enabled:
        CONTRACT_DEPLOYED && address !== undefined && tokenIds.length > 0,
    },
  });

  // tokenURIs aligned with tokenIds by index (undefined where unread).
  const tokenURIs = useMemo(
    () =>
      (uriReads.data ?? []).map((r) => {
        const result = r.result as string | undefined;
        return typeof result === "string" && result !== ""
          ? result
          : undefined;
      }),
    [uriReads.data],
  );

  // One query per token, keyed ["owned-metadata", id, tokenURI].
  // useQueries (not a hook-in-a-loop) so the query count may change with
  // the enumerated token list. Each query never throws: a failed fetch
  // resolves to undefined metadata.
  const metadataQueries = useQueries({
    queries: tokenIds.map((id, i) => {
      const tokenURI = tokenURIs[i];
      return {
        queryKey: ["owned-metadata", id.toString(), tokenURI] as const,
        queryFn: () =>
          tokenURI === undefined
            ? Promise.resolve(undefined)
            : fetchTokenMetadata(tokenURI),
        enabled: tokenURI !== undefined,
        staleTime: 60_000,
        retry: false,
      };
    }),
  });

  // Local gallery index, fetched once, for rarity/traits only.
  const galleryQuery = useQuery({
    queryKey: ["gallery-index"],
    queryFn: fetchGalleryIndex,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const localById = useMemo(() => {
    const map = new Map<number, GalleryToken>();
    for (const token of galleryQuery.data ?? []) {
      map.set(token.id, token);
    }
    return map;
  }, [galleryQuery.data]);

  const tokens = useMemo<OwnedTokenMeta[]>(
    () =>
      tokenIds.map((id, i) => {
        const tokenURI = tokenURIs[i];
        const metadata = metadataQueries[i]?.data;
        return {
          id,
          tokenURI,
          metadata,
          metadataSource: metadata !== undefined ? "on-chain" : "local",
          local: localById.get(Number(id)),
        };
      }),
    [tokenIds, tokenURIs, metadataQueries, localById],
  );

  return {
    deployed: owned.deployed,
    connected: owned.connected,
    isLoading:
      owned.isLoading ||
      uriReads.isLoading ||
      metadataQueries.some((q) => q.isFetching),
    balance: owned.balance,
    tokens,
  };
}
