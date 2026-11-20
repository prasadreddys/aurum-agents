/**
 * Local anvil integration test (Stages 4 + 5 verification — LOCAL ONLY).
 *
 * Deploys nothing to any real chain and spends no real BNB. It reads and
 * writes against a local anvil node (chain 31337) where the AurumAgents
 * contract was deployed with the Stage 9 deploy script.
 *
 * Usage (from repo/frontend):
 *   # 1. start anvil:  anvil --port 8545 --host 127.0.0.1
 *   # 2. deploy:       (see docs/stage4-report.md §4 — forge script)
 *   # 3. run:          CONTRACT_ADDRESS=0x5fb... OWNER_PRIVATE_KEY=0x... \
 *   #                    node scripts/anvil-integration-test.mjs
 *   #    OWNER_PRIVATE_KEY is anvil account 0's key, taken from the anvil
 *   #    startup log — never hardcoded, never printed.
 *
 * The account keys below are anvil's public well-known TEST keys (accounts
 * 1 and 2). They hold only fake anvil ETH and must never be used on a real
 * network.
 */
import { createPublicClient, createWalletClient, http, parseEther, parseEventLogs } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "node:fs";

const RPC = process.env.ANVIL_RPC ?? "http://127.0.0.1:8545";
const CONTRACT = process.env.CONTRACT_ADDRESS;
if (!CONTRACT || !/^0x[0-9a-fA-F]{40}$/.test(CONTRACT)) {
  console.error("CONTRACT_ADDRESS env var (0x + 40 hex) is required.");
  process.exit(2);
}

const OWNER_KEY = process.env.OWNER_PRIVATE_KEY;
if (!OWNER_KEY || !/^0x[0-9a-fA-F]{64}$/.test(OWNER_KEY)) {
  console.error("OWNER_PRIVATE_KEY env var (0x + 64 hex) is required.");
  process.exit(2);
}

const artifact = JSON.parse(
  readFileSync(
    new URL(
      "../../contracts/out/AurumAgents.sol/AurumAgents.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const abi = artifact.abi;

const publicClient = createPublicClient({ transport: http(RPC) });
// Anvil test accounts 1 and 2 (public test keys — fake ETH only).
const acct1 = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
);
const acct2 = privateKeyToAccount(
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
);
const wallet1 = createWalletClient({ account: acct1, transport: http(RPC) });
const wallet2 = createWalletClient({ account: acct2, transport: http(RPC) });
// Owner wallet (anvil account 0). Key comes from the anvil log via env var —
// never hardcoded, never printed. Only the address is logged.
const ownerAcct = privateKeyToAccount(OWNER_KEY);
const walletOwner = createWalletClient({
  account: ownerAcct,
  transport: http(RPC),
});
console.log(`owner account: ${ownerAcct.address}`);

let failures = 0;
function check(name, actual, expected) {
  const ok = String(actual) === String(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: ${actual} (expected ${expected})`);
  if (!ok) failures++;
}
async function expectRevert(name, fn) {
  try {
    await fn();
    console.log(`FAIL  ${name}: did NOT revert`);
    failures++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`PASS  ${name}: reverted (${msg.slice(0, 90)})`);
  }
}
async function read(fnName, args = []) {
  return publicClient.readContract({
    address: CONTRACT,
    abi,
    functionName: fnName,
    args,
  });
}

console.log(`contract: ${CONTRACT}  rpc: ${RPC}`);

// --- reads (the same view functions the frontend's hooks call) ---
check("name", await read("name"), "AURUM AGENTS");
check("symbol", await read("symbol"), "AURUM");
check("MAX_SUPPLY", await read("MAX_SUPPLY"), 5555n);
check("FREE_SUPPLY", await read("FREE_SUPPLY"), 1111n);
check("PAID_SUPPLY", await read("PAID_SUPPLY"), 4444n);
check("PAID_PRICE wei", await read("PAID_PRICE"), 1000000000000000n);
check("totalMinted (before)", await read("totalMinted"), 0n);
check("remainingFree (before)", await read("remainingFree"), 1111n);
check("remainingPaid (before)", await read("remainingPaid"), 4444n);
check("paused", await read("paused"), false);
check("owner", await read("owner"), "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
check("baseURI", await read("baseURI"), "https://example.invalid/metadata/");
check(
  "isFreeMintEligible(acct1)",
  await read("isFreeMintEligible", [acct1.address]),
  true,
);
check(
  "paidMintRemaining(acct2)",
  await read("paidMintRemaining", [acct2.address]),
  10n,
);

// --- free mint (account 1) ---
const freeTx = await wallet1.writeContract({
  address: CONTRACT,
  abi,
  functionName: "freeMint",
});
await publicClient.waitForTransactionReceipt({ hash: freeTx });
console.log(`PASS  freeMint tx: ${freeTx}`);
check("freeMinted (after)", await read("freeMinted"), 1n);
check("totalMinted (after free)", await read("totalMinted"), 1n);
check(
  "hasClaimedFree(acct1)",
  await read("hasClaimedFree", [acct1.address]),
  true,
);
check("balanceOf(acct1)", await read("balanceOf", [acct1.address]), 1n);
check(
  "tokenOfOwnerByIndex(acct1,0)",
  await read("tokenOfOwnerByIndex", [acct1.address, 0n]),
  1n,
);
check("ownerOf(1)", await read("ownerOf", [1n]), acct1.address);
await expectRevert("second freeMint reverts", () =>
  wallet1.writeContract({ address: CONTRACT, abi, functionName: "freeMint" }),
);

// --- paid mint x3 (account 2, exact 0.003 BNB) ---
const paidTx = await wallet2.writeContract({
  address: CONTRACT,
  abi,
  functionName: "paidMint",
  args: [3n],
  value: parseEther("0.003"),
});
const receipt = await publicClient.waitForTransactionReceipt({ hash: paidTx });
console.log(`PASS  paidMint x3 tx: ${paidTx} (status ${receipt.status})`);
check("paidMinted (after)", await read("paidMinted"), 3n);
check("totalMinted (after paid)", await read("totalMinted"), 4n);
check("paidMintedBy(acct2)", await read("paidMintedBy", [acct2.address]), 3n);
check(
  "paidMintRemaining(acct2)",
  await read("paidMintRemaining", [acct2.address]),
  7n,
);
check("ownerOf(2)", await read("ownerOf", [2n]), acct2.address);
check("ownerOf(4)", await read("ownerOf", [4n]), acct2.address);
await expectRevert("paidMint underpayment reverts", () =>
  wallet2.writeContract({
    address: CONTRACT,
    abi,
    functionName: "paidMint",
    args: [1n],
    value: parseEther("0.0005"),
  }),
);
await expectRevert("paidMint overpayment reverts", () =>
  wallet2.writeContract({
    address: CONTRACT,
    abi,
    functionName: "paidMint",
    args: [1n],
    value: parseEther("0.002"),
  }),
);
await expectRevert("paidMint qty 11 reverts", () =>
  wallet2.writeContract({
    address: CONTRACT,
    abi,
    functionName: "paidMint",
    args: [11n],
    value: parseEther("0.011"),
  }),
);

// --- Stage 5: owner setup ---
check("owner == ownerAcct", await read("owner"), ownerAcct.address);

// --- Stage 5: ownership enumeration for acct2 (3 paid NFTs: IDs 2,3,4) ---
check("balanceOf(acct2)", await read("balanceOf", [acct2.address]), 3n);
check(
  "tokenOfOwnerByIndex(acct2,0)",
  await read("tokenOfOwnerByIndex", [acct2.address, 0n]),
  2n,
);
check(
  "tokenOfOwnerByIndex(acct2,1)",
  await read("tokenOfOwnerByIndex", [acct2.address, 1n]),
  3n,
);
check(
  "tokenOfOwnerByIndex(acct2,2)",
  await read("tokenOfOwnerByIndex", [acct2.address, 2n]),
  4n,
);
check("ownerOf(2) == acct2", await read("ownerOf", [2n]), acct2.address);
check("ownerOf(4) == acct2", await read("ownerOf", [4n]), acct2.address);

// --- Stage 5: pause flow ---
await expectRevert("non-owner pause reverts", () =>
  wallet1.writeContract({ address: CONTRACT, abi, functionName: "pause" }),
);
const pauseTx = await walletOwner.writeContract({
  address: CONTRACT,
  abi,
  functionName: "pause",
});
await publicClient.waitForTransactionReceipt({ hash: pauseTx });
console.log(`PASS  pause tx: ${pauseTx}`);
check("paused (after pause)", await read("paused"), true);
await expectRevert("freeMint while paused reverts", () =>
  wallet2.writeContract({ address: CONTRACT, abi, functionName: "freeMint" }),
);
await expectRevert("paidMint while paused reverts", () =>
  wallet2.writeContract({
    address: CONTRACT,
    abi,
    functionName: "paidMint",
    args: [1n],
    value: parseEther("0.001"),
  }),
);
const unpauseTx = await walletOwner.writeContract({
  address: CONTRACT,
  abi,
  functionName: "unpause",
});
await publicClient.waitForTransactionReceipt({ hash: unpauseTx });
console.log(`PASS  unpause tx: ${unpauseTx}`);
check("paused (after unpause)", await read("paused"), false);

// --- Stage 5: withdraw ---
check(
  "contract balance (before withdraw)",
  await publicClient.getBalance({ address: CONTRACT }),
  parseEther("0.003"),
);
const withdrawTx = await walletOwner.writeContract({
  address: CONTRACT,
  abi,
  functionName: "withdraw",
});
await publicClient.waitForTransactionReceipt({ hash: withdrawTx });
console.log(`PASS  withdraw tx: ${withdrawTx}`);
check(
  "contract balance (after withdraw)",
  await publicClient.getBalance({ address: CONTRACT }),
  0n,
);

// --- Stage 5: base URI flow (LAST — freeze is one-way) ---
check(
  "tokenURI(1) (deploy base URI)",
  await read("tokenURI", [1n]),
  "https://example.invalid/metadata/1.json",
);
check("baseURIFrozen (before)", await read("baseURIFrozen"), false);
await expectRevert("non-owner setBaseURI reverts", () =>
  wallet1.writeContract({
    address: CONTRACT,
    abi,
    functionName: "setBaseURI",
    args: ["https://evil.invalid/meta/"],
  }),
);
const setUriTx = await walletOwner.writeContract({
  address: CONTRACT,
  abi,
  functionName: "setBaseURI",
  args: ["https://aurum.test/meta/"],
});
await publicClient.waitForTransactionReceipt({ hash: setUriTx });
console.log(`PASS  setBaseURI tx: ${setUriTx}`);
check("baseURI (after set)", await read("baseURI"), "https://aurum.test/meta/");
check(
  "tokenURI(1) (after set)",
  await read("tokenURI", [1n]),
  "https://aurum.test/meta/1.json",
);
const freezeTx = await walletOwner.writeContract({
  address: CONTRACT,
  abi,
  functionName: "freezeBaseURI",
});
await publicClient.waitForTransactionReceipt({ hash: freezeTx });
console.log(`PASS  freezeBaseURI tx: ${freezeTx}`);
check("baseURIFrozen (after freeze)", await read("baseURIFrozen"), true);
await expectRevert("setBaseURI after freeze reverts (owner)", () =>
  walletOwner.writeContract({
    address: CONTRACT,
    abi,
    functionName: "setBaseURI",
    args: ["https://aurum.test/meta2/"],
  }),
);

// --- Stage 6: event-log assertions (full anvil range) ---
// Pristine state from the flow above: 4 mints (1 free + 3 paid), one
// pause/unpause cycle, one 0.003 ETH withdraw, base URI set then frozen.
// The token-1 transfer in §6.2 runs AFTER these assertions, so it cannot
// pollute the expected log counts below.
const allLogs = await publicClient.getLogs({
  address: CONTRACT,
  fromBlock: 0n,
  toBlock: "latest",
});
const decodedLogs = parseEventLogs({ abi, logs: allLogs });
const logsOf = (name) => decodedLogs.filter((l) => l.eventName === name);

const freeLogs = logsOf("FreeMinted");
check("FreeMinted count", freeLogs.length, 1);
check("FreeMinted[0].minter", freeLogs[0]?.args.minter, acct1.address);
check("FreeMinted[0].tokenId", freeLogs[0]?.args.tokenId, 1n);

const paidLogs = logsOf("PaidMinted");
check("PaidMinted count", paidLogs.length, 3);
check(
  "PaidMinted tokenIds",
  paidLogs.map((l) => l.args.tokenId).join(","),
  "2,3,4",
);
check(
  "PaidMinted minters",
  [...new Set(paidLogs.map((l) => l.args.minter))].join(","),
  acct2.address,
);
check(
  "PaidMinted pricePaid each",
  paidLogs.map((l) => l.args.pricePaid).join(","),
  "1000000000000000,1000000000000000,1000000000000000",
);

const transferLogs = logsOf("Transfer");
check("Transfer count", transferLogs.length, 4);
check(
  "Transfer tokenIds",
  transferLogs.map((l) => l.args.tokenId).join(","),
  "1,2,3,4",
);
check(
  "Transfer from (all mints)",
  [...new Set(transferLogs.map((l) => l.args.from))].join(","),
  "0x0000000000000000000000000000000000000000",
);
check(
  "Transfer to",
  transferLogs.map((l) => l.args.to).join(","),
  [acct1.address, acct2.address, acct2.address, acct2.address].join(","),
);

const pausedLogs = logsOf("Paused");
check("Paused count", pausedLogs.length, 1);
check("Paused account", pausedLogs[0]?.args.account, ownerAcct.address);
const unpausedLogs = logsOf("Unpaused");
check("Unpaused count", unpausedLogs.length, 1);
check("Unpaused account", unpausedLogs[0]?.args.account, ownerAcct.address);

const withdrawnLogs = logsOf("Withdrawn");
check("Withdrawn count", withdrawnLogs.length, 1);
check("Withdrawn to", withdrawnLogs[0]?.args.to, ownerAcct.address);
check(
  "Withdrawn amount",
  withdrawnLogs[0]?.args.amount,
  parseEther("0.003"),
);

const baseUriSetLogs = logsOf("BaseURISet");
check("BaseURISet count", baseUriSetLogs.length, 1);
check(
  "BaseURISet baseURI",
  baseUriSetLogs[0]?.args.baseURI,
  "https://aurum.test/meta/",
);
const baseUriFrozenLogs = logsOf("BaseURIFrozen");
check("BaseURIFrozen count", baseUriFrozenLogs.length, 1);
check(
  "BaseURIFrozen baseURI",
  baseUriFrozenLogs[0]?.args.baseURI,
  "https://aurum.test/meta/",
);

// --- Stage 6: live-watch assertion ---
// Subscribe to Transfer, then move token 1 from acct1 to acct2 and assert
// the watch callback fires with the right tokenId/from/to.
const watchedTransfers = [];
const unwatch = publicClient.watchContractEvent({
  address: CONTRACT,
  abi,
  eventName: "Transfer",
  onLogs: (logs) => watchedTransfers.push(...logs),
});
const transferTx = await wallet1.writeContract({
  address: CONTRACT,
  abi,
  functionName: "transferFrom",
  args: [acct1.address, acct2.address, 1n],
});
await publicClient.waitForTransactionReceipt({ hash: transferTx });
console.log(`PASS  transferFrom token 1 tx: ${transferTx}`);
// viem polls the filter, so allow up to ~15 s for the callback to fire.
const watchDeadline = Date.now() + 15000;
while (watchedTransfers.length === 0 && Date.now() < watchDeadline) {
  await new Promise((r) => setTimeout(r, 250));
}
unwatch();
check("watchContractEvent Transfer fired", watchedTransfers.length >= 1, true);
const watchedTransfer = watchedTransfers.find(
  (l) => l.args.tokenId === 1n,
);
check("watched Transfer tokenId", watchedTransfer?.args.tokenId, 1n);
check("watched Transfer from", watchedTransfer?.args.from, acct1.address);
check("watched Transfer to", watchedTransfer?.args.to, acct2.address);
check("ownerOf(1) after transfer", await read("ownerOf", [1n]), acct2.address);

// --- Stage 6: final stats reads (transfer above changes ownership only) ---
check("totalMinted (final)", await read("totalMinted"), 4n);
check("freeMinted (final)", await read("freeMinted"), 1n);
check("paidMinted (final)", await read("paidMinted"), 3n);
check("remainingFree (final)", await read("remainingFree"), 1110n);
check("remainingPaid (final)", await read("remainingPaid"), 4441n);
check("paused (final)", await read("paused"), false);
check("baseURIFrozen (final)", await read("baseURIFrozen"), true);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
