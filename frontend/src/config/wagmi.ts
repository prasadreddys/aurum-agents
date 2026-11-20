/**
 * wagmi configuration (Stage 4) — BNB Smart Chain Mainnet ONLY (chain 56).
 *
 * Connector order is deliberate and must be preserved:
 *   1. Binance Web3 Wallet — injected provider `window.binancew3w.ethereum`
 *      (Binance Wallet SDK, "EVM-Compatible Provider"). Listed FIRST per
 *      the approved Stage 1 re-scope.
 *   2. MetaMask — injected provider (`window.ethereum` with isMetaMask).
 *   3. WalletConnect v2 — only when a real Reown project ID is configured
 *      (VITE_WC_PROJECT_ID). With no ID the connector is not created at
 *      all and the modal shows a "needs project ID" state.
 *
 * There is NO "Connect Binance Agent Wallet" connector anywhere: the
 * Binance Agentic Wallet has no browser provider and no website connect
 * flow (Stage 1 research §1.6; Binance FAQ warns against third-party
 * website sign-in). It is a copy-paste prompt track only.
 *
 * Network switching is NEVER silent: the app only ever requests a switch
 * via the user's explicit click (see NetworkBanner), using
 * wallet_switchEthereumChain. Connection persistence is wagmi's built-in
 * auto-reconnect (ssr: false, stored connector in localStorage).
 */
import { http, createConfig } from "wagmi";
import { bsc } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";
import type { EIP1193Provider } from "viem";
import { fallback } from "viem";
import {
  BSC_RPC_FALLBACK_URL,
  BSC_RPC_URL,
  WALLET_CONNECT_ENABLED,
  WC_PROJECT_ID,
} from "./env";

/** EIP-1193 provider exposed by Binance Web3 Wallet, when present. */
function binanceW3WProvider() {
  return typeof window !== "undefined"
    ? window.binancew3w?.ethereum
    : undefined;
}

/**
 * MetaMask's injected provider, when present (incl. multi-provider pages).
 * Cast through unknown: wagmi's provider-flag types require `isMetaMask`
 * to be the literal `true`, while the window type declares it as boolean.
 */
function metaMaskProvider(): EIP1193Provider | undefined {
  if (typeof window === "undefined") return undefined;
  const eth = window.ethereum;
  if (!eth) return undefined;
  if (eth.isMetaMask) return eth as unknown as EIP1193Provider;
  const found = eth.providers?.find((p) => p.isMetaMask);
  return found as EIP1193Provider | undefined;
}

export const config = createConfig({
  chains: [bsc],
  transports: {
    // Fallback transport: a single flaky public RPC must not blank reads
    // (the 18 Nov live test showed "—" for the balance when the dataseed
    // did not answer). Primary first, dataseed second.
    [bsc.id]: fallback([http(BSC_RPC_URL), http(BSC_RPC_FALLBACK_URL)]),
  },
  connectors: [
    injected({
      target: {
        id: "binance-w3w",
        name: "Binance Web3 Wallet",
        provider: binanceW3WProvider,
      },
    }),
    injected({
      target: {
        id: "metaMask",
        name: "MetaMask",
        provider: metaMaskProvider,
      },
    }),
    ...(WALLET_CONNECT_ENABLED
      ? [
          walletConnect({
            projectId: WC_PROJECT_ID as string,
            showQrModal: false,
            metadata: {
              name: "AURUM AGENTS",
              description:
                "5,555 premium AI-agent NFTs on BNB Smart Chain Mainnet. 1,111 free mints, 4,444 paid mints at 0.001 BNB.",
              url:
                typeof window !== "undefined"
                  ? window.location.origin
                  : "https://aurumagents.example",
              icons: [
                typeof window !== "undefined"
                  ? `${window.location.origin}/favicon.svg`
                  : "https://aurumagents.example/favicon.svg",
              ],
            },
          }),
        ]
      : []),
  ],
  ssr: false,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
