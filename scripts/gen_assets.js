"use strict";
/**
 * Asset generation orchestrator.
 * - Reads prompts from ../asset_prompts.json
 * - Backs up existing assets to /public/assets/_backup/<timestamp>
 * - Generates images via OpenAI Responses API (image_generation tool)
 * - Upscales with realesrgan-ncnn-vulkan / Upscayl / sharp fallback
 * - Vectorizes overlays via potrace (or falls back to simple embed)
 * - Converts to WebP (backgrounds) and SVG (overlays)
 * - Writes to /public/assets/
 *
 * CLI flags:
 *   --only <name>       Only process a specific asset (match prompt name)
 *   --skip-upscale      Skip upscaling step
 *   --no-bg-02          Skip bg-stone-02
 */
const fs = require("fs");
const path = require("path");
const { generateImage } = require("./lib/openai_images");
const { upscaleImage } = require("./lib/upscale");
const { convertToWebp, ensureDir, backupAssets, summarizeFiles } = require("./lib/convert");
const { vectorizeOverlay } = require("./lib/vectorize");

const ROOT = path.resolve(__dirname, "..");
const ASSETS_DIR = path.join(ROOT, "public", "assets");
const PROMPTS_PATH = path.join(ROOT, "asset_prompts.json");
const TMP_DIR = path.join(ROOT, "tmp_assets");

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { only: null, skipUpscale: false, noBg02: false };
  args.forEach((arg, i) => {
    if (arg === "--only") opts.only = args[i + 1];
    if (arg === "--skip-upscale") opts.skipUpscale = true;
    if (arg === "--no-bg-02") opts.noBg02 = true;
  });
  return opts;
}

async function main() {
  const opts = parseArgs();
  ensureDir(ASSETS_DIR);
  ensureDir(TMP_DIR);

  const prompts = JSON.parse(fs.readFileSync(PROMPTS_PATH, "utf8"));
  const backgrounds = prompts.backgrounds || [];
  const overlays = prompts.overlays || [];

  const backupDir = backupAssets(ASSETS_DIR);

  const targets = [];
  if (!opts.noBg02) targets.push(...backgrounds);
  else targets.push(...backgrounds.filter((b) => b.name !== "bg-stone-02"));
  targets.push(...overlays);
  if (opts.only) {
    targets.splice(0, targets.length, ...targets.filter((t) => t.name === opts.only));
  }

  const generated = [];
  for (const asset of targets) {
    const isOverlay = asset.filename.endsWith(".svg");
    const tmpPng = path.join(TMP_DIR, `${asset.name}.png`);
    console.log(`\n[generate] ${asset.name} -> ${tmpPng}`);

    const pngBuf = await generateImage({
      prompt: asset.prompt,
      size: asset.size,
      aspectRatio: asset.aspect_ratio,
      isOverlay,
    });
    fs.writeFileSync(tmpPng, pngBuf);

    let workBuf = pngBuf;
    if (!opts.skipUpscale) {
      console.log(`[upscale] ${asset.name}`);
      workBuf = await upscaleImage(tmpPng, { isOverlay });
      fs.writeFileSync(tmpPng, workBuf);
    }

    const dest = path.join(ASSETS_DIR, asset.filename);
    if (isOverlay) {
      console.log(`[vectorize] ${asset.name}`);
      await vectorizeOverlay(tmpPng, dest);
    } else {
      console.log(`[convert] ${asset.name} -> webp`);
      await convertToWebp(tmpPng, dest, 85);
    }
    generated.push(dest);
  }

  const summary = summarizeFiles(generated);
  console.log("\n=== Asset generation summary ===");
  console.log(`Backup: ${backupDir || "none"}`);
  summary.forEach((s) => {
    console.log(`- ${path.basename(s.file)} :: ${s.dimensions || "n/a"} :: ${s.sizeKb} KB`);
  });
  console.log("Done.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
