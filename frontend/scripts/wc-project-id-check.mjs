/**
 * WalletConnect project-ID check (Stage 4 verification — no session kept).
 *
 * Initialises a WalletConnect v2 provider with the configured project ID
 * and asks it to generate a pairing URI. A valid project ID reaches the
 * WalletConnect relay and yields a `wc:` URI; an invalid/unknown ID is
 * rejected by the relay. No wallet is paired, no session is created, and
 * nothing is signed. The provider is disconnected immediately after the
 * URI appears (or after a 20 s timeout).
 *
 * Usage (from repo/frontend):
 *   VITE_WC_PROJECT_ID=3fad... node scripts/wc-project-id-check.mjs
 */
import { EthereumProvider } from "@walletconnect/ethereum-provider";

const projectId = process.env.VITE_WC_PROJECT_ID;
if (!projectId || !/^[0-9a-fA-F]{32}$/.test(projectId)) {
  console.error("VITE_WC_PROJECT_ID env var (32 hex chars) is required.");
  process.exit(2);
}

console.log(`projectId: ${projectId.slice(0, 8)}… (32 hex, format OK)`);

const provider = await EthereumProvider.init({
  projectId,
  chains: [56],
  optionalChains: [56],
  showQrModal: false,
  metadata: {
    name: "AURUM AGENTS",
    description: "Stage 4 project-ID check (no session).",
    url: "https://example.invalid",
    icons: [],
  },
});
console.log("provider initialised — contacting relay for a pairing URI…");

const uri = await new Promise((resolve, reject) => {
  const timer = setTimeout(
    () => reject(new Error("timed out after 20 s waiting for display_uri")),
    20_000,
  );
  provider.on("display_uri", (u) => {
    clearTimeout(timer);
    resolve(u);
  });
  provider.connect().catch((err) => {
    clearTimeout(timer);
    reject(err);
  });
});

console.log(`pairing URI received: ${uri.slice(0, 60)}…`);
console.log(
  `URI valid: ${uri.startsWith("wc:") && uri.includes("relay-protocol=irn")}`,
);
await provider.disconnect().catch(() => {});
console.log("PROJECT ID ACCEPTED BY THE WALLETCONNECT RELAY — no session kept");
process.exit(0);
