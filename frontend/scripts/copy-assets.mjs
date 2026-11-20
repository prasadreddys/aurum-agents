#!/usr/bin/env node
/**
 * AURUM AGENTS — asset copy step (Stage 2).
 *
 * Copies the generated artwork, gallery index and metadata into
 * frontend/public/ so `vite dev` and `vite build` can serve them.
 *
 *   artwork/images/*.webp        -> public/artwork/*.webp
 *   artwork/gallery-index.json   -> public/gallery-index.json
 *   metadata/*.json              -> public/metadata/*.json
 *
 * Idempotent: a file is copied only when missing or when its size differs
 * from the source. Safe to run before every dev/build (wired as predev /
 * prebuild in package.json).
 *
 * The single source of truth stays in repo/artwork and repo/metadata —
 * public/ is build output, never edited by hand.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_ART = join(ROOT, "..", "artwork", "images");
const SRC_INDEX = join(ROOT, "..", "artwork", "gallery-index.json");
const SRC_META = join(ROOT, "..", "metadata");
const DST_ART = join(ROOT, "public", "artwork");
const DST_META = join(ROOT, "public", "metadata");

function copyDir(src, dst, label, filter) {
  if (!existsSync(src)) {
    console.log(`[copy-assets] SKIP ${label}: source missing (${src})`);
    return { copied: 0, total: 0 };
  }
  mkdirSync(dst, { recursive: true });
  const files = readdirSync(src).filter((f) => !f.startsWith(".") && (!filter || filter(f)));
  let copied = 0;
  for (const f of files) {
    const s = join(src, f);
    const d = join(dst, f);
    if (!existsSync(d) || statSync(s).size !== statSync(d).size) {
      copyFileSync(s, d);
      copied++;
    }
  }
  console.log(`[copy-assets] ${label}: ${files.length} files, ${copied} copied`);
  return { copied, total: files.length };
}

function copyOne(src, dst, label) {
  if (!existsSync(src)) {
    console.log(`[copy-assets] SKIP ${label}: source missing (${src})`);
    return;
  }
  mkdirSync(dirname(dst), { recursive: true });
  if (!existsSync(dst) || statSync(src).size !== statSync(dst).size) {
    copyFileSync(src, dst);
    console.log(`[copy-assets] ${label}: copied`);
  } else {
    console.log(`[copy-assets] ${label}: up to date`);
  }
}

copyDir(SRC_ART, DST_ART, "artwork");
copyOne(SRC_INDEX, join(ROOT, "public", "gallery-index.json"), "gallery-index");
copyDir(SRC_META, DST_META, "metadata", (f) => f.endsWith(".json"));
