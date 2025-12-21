"use strict";
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const { upscaleImage } = require("./lib/upscale");
const { ensureDir, convertToWebp } = require("./lib/convert");

const ROOT = path.resolve(__dirname, "..");
const PROMPTS = path.join(ROOT, "asset_prompts.json");
const TMP = path.join(ROOT, "tmp_assets");
const OUT = path.join(ROOT, "public", "assets", "upscaled");

function parseSize(sizeStr) {
  const m = /^([0-9]+)x([0-9]+)$/.exec(sizeStr);
  if (!m) return null;
  return { w: parseInt(m[1], 10), h: parseInt(m[2], 10) };
}

async function processOne(assetName) {
  const prompts = JSON.parse(fs.readFileSync(PROMPTS, "utf8"));
  const bg = (prompts.backgrounds || []).find((b) => b.name === assetName);
  if (!bg) throw new Error(`No prompt entry for ${assetName}`);
  const src = path.join(TMP, `${assetName}.png`);
  if (!fs.existsSync(src)) throw new Error(`Source not found: ${src}`);

  ensureDir(OUT);
  console.log(`Upscaling ${assetName} (source: ${src})`);

  // First pass: run the project's upscaler to enhance detail
  const upBuf = await upscaleImage(src, { isOverlay: false });
  const upTmp = path.join(TMP, `${assetName}-gen-up.png`);
  fs.writeFileSync(upTmp, upBuf);

  // Then resize to exact target dims if provided
  const dims = parseSize(bg.size || "1024x1536");
  const resizedTmp = path.join(TMP, `${assetName}-gen-resized.png`);
  if (dims) {
    await sharp(upTmp).resize(dims.w, dims.h, { fit: 'cover' }).png().toFile(resizedTmp);
  } else {
    fs.copyFileSync(upTmp, resizedTmp);
  }

  const outPath = path.join(OUT, bg.filename);
  await convertToWebp(resizedTmp, outPath, 90);
  console.log(`Wrote ${outPath}`);
  return outPath;
}

async function main() {
  const targets = ["bg-stone-01", "bg-stone-02"];
  const results = [];
  for (const t of targets) {
    try {
      const r = await processOne(t);
      results.push(r);
    } catch (err) {
      console.error(`Failed ${t}:`, err && err.message ? err.message : err);
    }
  }
  console.log("Done. Upscaled files:");
  results.forEach((r) => console.log(` - ${r}`));
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
