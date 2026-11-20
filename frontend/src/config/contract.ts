/**
 * AurumAgents contract wiring (Stage 4).
 *
 * The contract is NOT deployed on BNB Smart Chain Mainnet — there is no
 * address yet (Stage 9). `CONTRACT_ADDRESS` is undefined until the owner
 * sets VITE_CONTRACT_ADDRESS after the approved deployment. Every read
 * hook in this app is gated on CONTRACT_DEPLOYED and must render
 * CONTRACT NOT DEPLOYED while it is false. No address is ever invented.
 */
import type { Address } from "viem";
import { aurumAgentsAbi } from "../abi/AurumAgents";
import { CONTRACT_ADDRESS, CONTRACT_DEPLOYED } from "./env";

export { aurumAgentsAbi };
export { CONTRACT_ADDRESS, CONTRACT_DEPLOYED };

/** Zero address — used only as a placeholder where wagmi requires an address. */
export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as Address;

/** BscScan links — the only explorer for this project (chain 56). */
export const bscScanTxUrl = (hash: string) =>
  `https://bscscan.com/tx/${hash}`;
export const bscScanAddressUrl = (address: string) =>
  `https://bscscan.com/address/${address}`;
export const bscScanTokenUrl = (tokenId: number | bigint) =>
  CONTRACT_ADDRESS
    ? `https://bscscan.com/token/${CONTRACT_ADDRESS}?a=${tokenId}`
    : "https://bscscan.com";
