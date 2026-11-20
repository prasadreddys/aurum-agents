/// <reference types="vite/client" />

import type { EIP1193Provider } from "viem";

/**
 * Binance Web3 Wallet exposes an EIP-1193 provider at
 * `window.binancew3w.ethereum` inside the Binance App's DApp browser
 * (Binance Wallet SDK docs, "EVM-Compatible Provider").
 *
 * NOTE: this is the Binance *Web3* Wallet. The Binance *Agentic* Wallet
 * has no browser provider at all — no `window` object, no dApp connect
 * flow — and must never be looked for here (Stage 1 research §1.6).
 */
interface BinanceW3W {
  ethereum?: EIP1193Provider;
}

declare global {
  interface Window {
    binancew3w?: BinanceW3W;
    ethereum?: EIP1193Provider & {
      isMetaMask?: boolean;
      providers?: (EIP1193Provider & { isMetaMask?: boolean })[];
    };
  }
}

export {};
