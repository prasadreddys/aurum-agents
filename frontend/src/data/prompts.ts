/**
 * AURUM AGENTS — Binance Agent Wallet prompt center (Stage 2).
 *
 * RE-SCOPE (Stage 1 research, §1.5/§1.6): Binance Agentic Wallet is NOT a
 * dApp wallet — it has no browser provider, no website connect flow, and no
 * JavaScript SDK. A website cannot "connect" it, and the Agentic skill has
 * NO native NFT mint command. The only mint path is Developer mode
 * (custom contract call), which Binance warns can lead to asset loss and
 * which uses Secure Auto Sign (no per-transaction confirmations unless the
 * user sets high-risk handling to "Require App confirmation").
 *
 * These prompts are therefore a copy-paste library for the user's OWN AI
 * agent (Claude Code, OpenClaw, ChatGPT, Copilot) with the Binance
 * Agentic Wallet skill installed — NOT website actions. The dApp-connectable
 * wallet is Binance Web3 Wallet (WalletConnect v2 + injected provider);
 * wallet wiring landed in Stage 4.
 *
 * Prompts that read the contract only work after the contract is deployed
 * (Stage 9). Until then they are marked "requires deployed contract".
 */

export type PromptTrack = "agent-read" | "agent-mint" | "agent-help" | "dapp";

export interface AgentPrompt {
  id: number;
  title: string;
  track: PromptTrack;
  requiresContract: boolean;
  text: string;
  note?: string;
}

export const TRACK_LABEL: Record<PromptTrack, string> = {
  "agent-read": "Your AI agent · read-only",
  "agent-mint": "Your AI agent · mint (Developer mode)",
  "agent-help": "Your AI agent · help",
  dapp: "This website · Stage 4",
};

export const DEVELOPER_MODE_WARNING =
  "Developer mode required. Binance warns Developer mode lets an agent execute " +
  "custom contract calls and can lead to asset loss. Enable it only in the " +
  "Binance App, set high-risk transaction handling to “Require App confirmation” " +
  "first, and disable Developer mode when you are done. Never paste a contract " +
  "address from an unverified source — use the deployed AURUM AGENTS address " +
  "published by the project owner after Stage 9.";

export const PROMPTS: AgentPrompt[] = [
  {
    id: 1,
    title: "Connect wallet",
    track: "agent-read",
    requiresContract: false,
    text: "Sign in to Binance Agentic Wallet and show my wallet address, BNB balance, and confirm we are on BNB Smart Chain Mainnet (chain 56).",
    note: "Runs in your own AI agent, not on this website — a website cannot connect the Agentic Wallet (Binance FAQ warns against third-party website sign-in). The website connect flow (Stage 4) uses Binance Web3 Wallet instead.",
  },
  {
    id: 2,
    title: "Check free mint",
    track: "agent-read",
    requiresContract: true,
    text: "Read the AURUM AGENTS contract on BNB Smart Chain Mainnet and tell me how many of the 1,111 free NFTs remain, and whether my wallet has already claimed its free NFT.",
  },
  {
    id: 3,
    title: "Free mint",
    track: "agent-mint",
    requiresContract: true,
    text: "Mint one free AURUM AGENTS NFT to my connected Agentic Wallet. First verify the free allocation still has supply and that my wallet has not claimed its free NFT, then build the mint call and ask for transaction approval in the Binance App before executing.",
    note: DEVELOPER_MODE_WARNING,
  },
  {
    id: 4,
    title: "Paid mint",
    track: "agent-mint",
    requiresContract: true,
    text: "Mint 3 AURUM AGENTS NFTs at 0.001 BNB each (total 0.003 BNB) to my connected Agentic Wallet. Verify my remaining paid-mint allowance (max 10 per wallet) first, calculate the exact total, then build the payable mint call and ask for transaction approval in the Binance App before executing. Change the quantity to any number from 1 to 10.",
    note: DEVELOPER_MODE_WARNING,
  },
  {
    id: 5,
    title: "Check NFT balance",
    track: "agent-read",
    requiresContract: true,
    text: "Check my AURUM AGENTS NFT balance on BNB Smart Chain Mainnet and list the token IDs I own.",
  },
  {
    id: 6,
    title: "Collection status",
    track: "agent-read",
    requiresContract: true,
    text: "Read the live AURUM AGENTS contract and show total supply, total minted, remaining free supply, remaining paid supply, and mint statistics.",
  },
  {
    id: 7,
    title: "Transaction status",
    track: "agent-read",
    requiresContract: true,
    text: "Check my latest AURUM AGENTS mint transaction using its transaction hash and verify the result on BscScan (https://bscscan.com).",
  },
  {
    id: 8,
    title: "Wallet eligibility",
    track: "agent-read",
    requiresContract: true,
    text: "Verify my wallet's free mint eligibility and remaining paid mint allowance directly from the AURUM AGENTS smart contract on BNB Smart Chain Mainnet.",
  },
  {
    id: 9,
    title: "Collection details",
    track: "agent-read",
    requiresContract: true,
    text: "Show the AURUM AGENTS collection contract address, token standard (ERC-721), total supply (5,555), mint price (0.001 BNB paid, free for the first 1,111), and metadata information.",
  },
  {
    id: 10,
    title: "Help",
    track: "agent-help",
    requiresContract: false,
    text: "Explain how to connect a wallet to AURUM AGENTS, mint a free or paid NFT, and verify my ownership on BNB Smart Chain Mainnet — including the difference between Binance Web3 Wallet (connects to this website) and Binance Agentic Wallet (operated by my own AI agent).",
  },
];
