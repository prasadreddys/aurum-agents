#!/usr/bin/env node
/**
 * AURUM AGENTS — Cloudflare Pages direct-upload deploy (Stage 8).
 *
 * Uploads a prebuilt directory to a Pages project via the Pages REST API
 * WITHOUT wrangler, because wrangler's parallel file handling dies with
 * EMFILE on this VM (fd hard limit 4096) once the site holds 11,188 files.
 * This script reads files strictly one at a time (a single open fd during
 * hashing) and uploads pre-read in-memory buffers with bounded concurrency
 * (default 3), so open-fd count stays in single digits throughout.
 *
 * Protocol (matches wrangler 4's own implementation; verified against the
 * Pages direct-upload API docs + wrangler's source behaviour):
 *   1. GET  /accounts/{id}/pages/projects/{name}/upload-token  -> JWT
 *   2. Hash each file: blake3(base64(bytes) + extNoDot), hex, first 32 chars
 *   3. POST /pages/assets/check-missing {hashes} (JWT)          -> missing subset
 *   4. POST /pages/assets/upload  [{key, value, metadata, base64}] (JWT),
 *      batched to <=40 MiB / <=2000 files, concurrency 3, retry 5x
 *   5. POST /accounts/{id}/pages/projects/{name}/deployments (multipart:
 *      manifest JSON {"/path": hash} + _headers file part + branch)
 *   6. Poll GET .../deployments/{id} until latest_stage deploy = success
 *
 * `_headers` / `_redirects` / `_routes.json` are special files: excluded
 * from the manifest and attached to the deployment create call instead.
 *
 * Auth: CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID from the environment.
 * The token is NEVER printed or written anywhere by this script.
 *
 * Metadata substitution: --substitute-base-uri <url> replaces the literal
 * "{BASE_URI}" placeholder inside metadata/*.json at upload time ONLY
 * (repo sources keep the placeholder). The contract's baseURI (Stage 9)
 * will be <site>/metadata/; the metadata `image` field must point at the
 * artwork base, i.e. <site>/artwork — pass that URL.
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
 *     node scripts/pages-direct-upload.mjs \
 *       [--dir ../dist] [--project aurum-agents-preview] [--branch main] \
 *       [--substitute-base-uri https://aurum-agents-preview.pages.dev/artwork] \
 *       [--concurrency 3] [--dry-run]
 *
 * Network: this VM reaches the internet through an egress proxy; run with
 * NODE_USE_ENV_PROXY=1 so Node's fetch honours HTTPS_PROXY.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, extname, relative, sep } from "node:path";

const require = createRequire(import.meta.url);
// blake3 is a devDependency of the frontend (@napi-rs/blake-hash), so it
// resolves from frontend/node_modules. Fallbacks (older checkouts) try a
// workspace-level and a /tmp install in that order.
let blake3Hex = null;
for (const p of [
  "@napi-rs/blake-hash",
  "/home/hatch/workspace/pages-deploy/node_modules/@napi-rs/blake-hash",
  "/tmp/pages-deploy/node_modules/@napi-rs/blake-hash",
]) {
  try {
    const mod = require(p);
    blake3Hex = (buf) => mod.blake3(buf).toString("hex");
    break;
  } catch {
    /* try next location */
  }
}
if (!blake3Hex) {
  console.error(
    "ERROR: @napi-rs/blake-hash not found. Install it first: " +
      "cd repo/frontend && npm install --save-dev @napi-rs/blake-hash@1.4.0",
  );
  process.exit(2);
}

const API = "https://api.cloudflare.com/client/v4";
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_BATCH_BYTES = 40 * 1024 * 1024;
const MAX_BATCH_FILES = 2000;
const SPECIAL_ROOT = new Set(["_headers", "_redirects", "_routes.json", "_worker.js"]);
const SKIP_NAMES = new Set([".DS_Store"]);
const SKIP_DIRS = new Set(["node_modules", ".git", ".wrangler", "functions"]);

const CONTENT_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".map": "application/json",
};

function parseArgs(argv) {
  const o = {
    dir: null,
    project: "aurumagents",
    branch: "main",
    substituteBaseUri: null,
    concurrency: 3,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dir") o.dir = argv[++i];
    else if (a === "--project") o.project = argv[++i];
    else if (a === "--branch") o.branch = argv[++i];
    else if (a === "--substitute-base-uri") o.substituteBaseUri = argv[++i];
    else if (a === "--concurrency") o.concurrency = Number(argv[++i]);
    else if (a === "--dry-run") o.dryRun = true;
    else {
      console.error(`ERROR: unknown arg: ${a}`);
      process.exit(2);
    }
  }
  if (!o.dir) {
    console.error("ERROR: --dir <dist directory> is required.");
    process.exit(2);
  }
  return o;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function apiJson(url, { method = "GET", token, jwt, body, timeoutMs = 120_000 } = {}) {
  const headers = { Authorization: `Bearer ${jwt ?? token}` };
  let payload;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(url, {
    method,
    headers,
    body: payload,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok || (json && json.success === false)) {
    const detail = json?.errors?.map((e) => e.message).join("; ") ?? text.slice(0, 300);
    throw new Error(`API ${method} ${url} -> HTTP ${res.status}: ${detail}`);
  }
  return json;
}

async function withRetry(fn, label, maxAttempts = 5) {
  let delay = 1000;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = String(err?.message ?? err);
      if (attempt === maxAttempts) throw new Error(`${label} failed after ${maxAttempts} attempts: ${msg}`);
      console.error(`  [retry ${attempt}/${maxAttempts}] ${label}: ${msg.slice(0, 160)}`);
      await sleep(delay);
      delay *= 2;
    }
  }
}

// Peak open-fd sampler (Linux): samples /proc/self/fd while work runs.
let maxFds = 0;
let fdSampler = null;
async function sampleFds() {
  try {
    const fds = await readdir("/proc/self/fd");
    if (fds.length > maxFds) maxFds = fds.length;
  } catch {
    /* not Linux; ignore */
  }
}
function startFdSampler() {
  fdSampler = setInterval(() => void sampleFds(), 200);
}
function stopFdSampler() {
  clearInterval(fdSampler);
}

async function walk(dir, out) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      await walk(full, out);
    } else if (e.isFile()) {
      if (SKIP_NAMES.has(e.name)) continue;
      out.push(full);
    }
  }
}

function contentTypeFor(relPath) {
  return CONTENT_TYPES[extname(relPath).toLowerCase()] ?? "application/octet-stream";
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !accountId) {
    console.error("ERROR: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set in the environment.");
    process.exit(2);
  }

  console.log(`[pages-upload] dir=${opts.dir} project=${opts.project} branch=${opts.branch} dryRun=${opts.dryRun}`);
  startFdSampler();

  // 1. Walk + hash (strictly sequential reads: one open fd at a time).
  const allFiles = [];
  await walk(opts.dir, allFiles);
  console.log(`[pages-upload] files on disk: ${allFiles.length}`);
  const manifest = {};
  const assets = []; // { key, rel, bytes, contentType } — bytes held in memory
  let special = {};
  let substitutions = 0;
  for (const full of allFiles) {
    const rel = relative(opts.dir, full).split(sep).join("/");
    const st = await stat(full);
    if (st.size > MAX_FILE_BYTES) {
      throw new Error(`File exceeds the 25 MiB Pages limit: ${rel} (${st.size} bytes)`);
    }
    if (SPECIAL_ROOT.has(rel)) {
      special[rel] = full;
      continue;
    }
    let bytes = await readFile(full);
    if (
      opts.substituteBaseUri &&
      rel.startsWith("metadata/") &&
      rel.endsWith(".json") &&
      bytes.includes("{BASE_URI}")
    ) {
      const text = bytes.toString("utf8").replaceAll("{BASE_URI}", opts.substituteBaseUri);
      bytes = Buffer.from(text, "utf8");
      substitutions++;
    }
    const ext = extname(rel).replace(/^\./, "");
    const hash = blake3Hex(Buffer.concat([Buffer.from(bytes.toString("base64"), "utf8"), Buffer.from(ext, "utf8")])).slice(0, 32);
    manifest[`/${rel}`] = hash;
    assets.push({ key: hash, rel, bytes, contentType: contentTypeFor(rel) });
    await sampleFds();
    if (assets.length % 2000 === 0) console.log(`[pages-upload] hashed ${assets.length}/${allFiles.length}...`);
  }
  console.log(
    `[pages-upload] manifest entries: ${Object.keys(manifest).length}; special files: ${Object.keys(special).join(", ") || "none"}; metadata substitutions: ${substitutions}`,
  );

  // 2. Upload token (JWT for asset calls).
  let jwt = await withRetry(
    async () => {
      const j = await apiJson(`${API}/accounts/${accountId}/pages/projects/${opts.project}/upload-token`, { token });
      return j.result.jwt;
    },
    "GET upload-token",
  );
  console.log("[pages-upload] upload token obtained");

  const refreshJwt = async () => {
    const j = await apiJson(`${API}/accounts/${accountId}/pages/projects/${opts.project}/upload-token`, { token });
    jwt = j.result.jwt;
  };

  // 3. check-missing (chunked at 5000 hashes per call).
  const allHashes = assets.map((a) => a.key);
  const missing = new Set();
  for (let i = 0; i < allHashes.length; i += 5000) {
    const chunk = allHashes.slice(i, i + 5000);
    const res = await withRetry(
      async () => apiJson(`${API}/pages/assets/check-missing`, { method: "POST", jwt, body: { hashes: chunk } }),
      `POST check-missing (${i}-${i + chunk.length})`,
    );
    for (const h of res.result ?? []) missing.add(h);
  }
  const toUpload = assets.filter((a) => missing.has(a.key));
  const totalUploadBytes = toUpload.reduce((n, a) => n + a.bytes.length, 0);
  console.log(
    `[pages-upload] check-missing: ${allHashes.length} hashed, ${allHashes.length - missing.size} already present, ${toUpload.length} to upload (${(totalUploadBytes / 1048576).toFixed(1)} MiB)`,
  );

  if (opts.dryRun) {
    stopFdSampler();
    console.log(JSON.stringify({ dryRun: true, filesTotal: allFiles.length, manifestEntries: Object.keys(manifest).length, alreadyPresent: allHashes.length - missing.size, toUpload: toUpload.length, uploadMiB: +(totalUploadBytes / 1048576).toFixed(2), substitutions, maxOpenFds: maxFds }, null, 2));
    return;
  }

  // 4. Upload missing assets in batches (<=40 MiB, <=2000 files), concurrency N.
  const batches = [];
  let cur = [];
  let curBytes = 0;
  for (const a of toUpload) {
    if (cur.length >= MAX_BATCH_FILES || curBytes + a.bytes.length > MAX_BATCH_BYTES) {
      batches.push(cur);
      cur = [];
      curBytes = 0;
    }
    cur.push(a);
    curBytes += a.bytes.length;
  }
  if (cur.length) batches.push(cur);
  console.log(`[pages-upload] uploading ${batches.length} batch(es) with concurrency ${opts.concurrency}...`);
  let uploaded = 0;
  let batchIdx = 0;
  async function uploadBatch(batch) {
    const n = ++batchIdx;
    const body = batch.map((a) => ({ key: a.key, value: a.bytes.toString("base64"), metadata: { contentType: a.contentType }, base64: true }));
    await withRetry(async () => {
      try {
        await apiJson(`${API}/pages/assets/upload`, { method: "POST", jwt, body, timeoutMs: 300_000 });
      } catch (err) {
        if (String(err?.message ?? "").includes("401")) await refreshJwt();
        throw err;
      }
    }, `POST assets/upload batch ${n}/${batches.length}`);
    uploaded += batch.length;
    console.log(`[pages-upload] batch ${n}/${batches.length} done (${uploaded}/${toUpload.length} files)`);
  }
  for (let i = 0; i < batches.length; i += opts.concurrency) {
    const chunk = batches.slice(i, i + opts.concurrency);
    await Promise.all(chunk.map(uploadBatch));
  }

  // 5. Create the deployment (multipart: manifest + _headers + branch).
  console.log("[pages-upload] creating deployment...");
  const form = new FormData();
  form.append("manifest", JSON.stringify(manifest));
  form.append("branch", opts.branch);
  if (special["_headers"]) {
    form.append("_headers", new Blob([await readFile(special["_headers"])]), "_headers");
  }
  if (special["_redirects"]) {
    form.append("_redirects", new Blob([await readFile(special["_redirects"])]), "_redirects");
  }
  const createRes = await withRetry(async () => {
    const res = await fetch(`${API}/accounts/${accountId}/pages/projects/${opts.project}/deployments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: AbortSignal.timeout(300_000),
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* ignore */
    }
    if (!res.ok || (json && json.success === false)) {
      const detail = json?.errors?.map((e) => e.message).join("; ") ?? text.slice(0, 300);
      throw new Error(`create deployment -> HTTP ${res.status}: ${detail}`);
    }
    return json;
  }, "POST create deployment");
  const deployment = createRes.result;
  console.log(`[pages-upload] deployment created: id=${deployment.id} url=${deployment.url}`);

  // 6. Poll until deploy succeeds.
  const deadline = Date.now() + 10 * 60 * 1000;
  let final = null;
  while (Date.now() < deadline) {
    await sleep(5000);
    const j = await apiJson(`${API}/accounts/${accountId}/pages/projects/${opts.project}/deployments/${deployment.id}`, { token });
    const stage = j.result?.latest_stage;
    console.log(`[pages-upload] stage: ${stage?.name} / ${stage?.status}`);
    if (stage?.name === "deploy" && stage?.status === "success") {
      final = j.result;
      break;
    }
    if (stage?.status === "failure" || stage?.status === "canceled") {
      throw new Error(`Deployment ${stage?.status} at stage ${stage?.name}`);
    }
  }
  if (!final) throw new Error("Deployment did not reach deploy/success within 10 minutes");
  stopFdSampler();
  console.log(
    JSON.stringify(
      {
        filesTotal: allFiles.length,
        manifestEntries: Object.keys(manifest).length,
        alreadyPresent: allHashes.length - missing.size,
        uploaded: toUpload.length,
        uploadMiB: +(totalUploadBytes / 1048576).toFixed(2),
        substitutions,
        deploymentId: final.id,
        deploymentUrl: final.url,
        productionUrl: `https://${opts.project}.pages.dev`,
        maxOpenFds: maxFds,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  stopFdSampler();
  console.error(`ERROR: ${err?.message ?? err}`);
  process.exit(1);
});
