/**
 * Environment configuration (Stage 4).
 *
 * Every value here is public by design (client-side env vars). Nothing
 * secret may ever be read from import.meta.env in this app.
 *
 * - VITE_WC_PROJECT_ID: free Reown Cloud project ID for WalletConnect.
 *   Empty until the owner creates one (Blocker B5). Never invented.
 * - VITE_CONTRACT_ADDRESS: AurumAgents on BSC Mainnet. Empty until the
 *   Stage 9 deployment. Never invented — an empty value means the contract
 *   is not deployed and every read shows CONTRACT NOT DEPLOYED.
 * - VITE_BSC_RPC_URL: public BSC RPC for read-only calls (no key).
 *   Default is PublicNode; VITE_BSC_RPC_FALLBACK_URL (default the BNB
 *   dataseed) is tried when the primary does not answer.
 */
import type { Address } from "viem";

function readEnv(name: string): string | undefined {
  const raw = (import.meta.env as Record<string, string | undefined>)[name];
  const value = raw?.trim();
  return value ? value : undefined;
}

function isAddress(value: string | undefined): value is Address {
  return value !== undefined && /^0x[0-9a-fA-F]{40}$/.test(value);
}

/** Free Reown Cloud project ID for WalletConnect, or undefined if not set. */
const rawProjectId = readEnv("VITE_WC_PROJECT_ID");
/**
 * A Reown project ID is 32 hex chars. The .env.example placeholder
 * ("your-reown-project-id-here") and any malformed value are treated as
 * "not configured" — never passed to WalletConnect.
 */
export const WC_PROJECT_ID =
  rawProjectId !== undefined && /^[0-9a-fA-F]{32}$/.test(rawProjectId)
    ? rawProjectId
    : undefined;

/** WalletConnect is only offered when a real project ID is configured. */
export const WALLET_CONNECT_ENABLED = WC_PROJECT_ID !== undefined;

/**
 * Deployed AurumAgents contract address, or undefined while the contract
 * is not deployed. A malformed value is treated as "not deployed" — it is
 * never used as an address.
 */
const rawContractAddress = readEnv("VITE_CONTRACT_ADDRESS");
export const CONTRACT_ADDRESS: Address | undefined = isAddress(
  rawContractAddress,
)
  ? rawContractAddress
  : undefined;

/** True only once Stage 9 has deployed the contract and set the address. */
export const CONTRACT_DEPLOYED = CONTRACT_ADDRESS !== undefined;

/**
 * Public BSC RPC endpoint for read-only calls (no API key). PublicNode is
 * the default: the BNB dataseed (previous default) did not answer the
 * balance read in the 18 Nov live wallet test.
 */
export const BSC_RPC_URL =
  readEnv("VITE_BSC_RPC_URL") ?? "https://bsc-rpc.publicnode.com";

/** Fallback BSC RPC, tried when the primary endpoint does not answer. */
export const BSC_RPC_FALLBACK_URL =
  readEnv("VITE_BSC_RPC_FALLBACK_URL") ?? "https://bsc-dataseed.bnbchain.org";
