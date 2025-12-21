"use strict";
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const { upscaleImage } = require("./lib/upscale");
const { ensureDir, convertToWebp } = require("./lib/convert");

const ROOT = path.resolve(__dirname, "..");
const PROMPTS = path.join(ROOT, "asset_prompts.json");
const ASSETS = path.join(ROOT, "public", "assets");
const OUT = path.join(ASSETS, "upscaled");

function parseSize(sizeStr) {
  const m = /^([0-9]+)x([0-9]+)$/.exec(sizeStr);
  if (!m) return null;
  return { w: parseInt(m[1], 10), h: parseInt(m[2], 10) };
}

async function processWebp(assetName) {
  const prompts = JSON.parse(fs.readFileSync(PROMPTS, "utf8"));
  const bg = (prompts.backgrounds || []).find((b) => b.name === assetName);
  if (!bg) throw new Error(`No prompt entry for ${assetName}`);

  const srcWebp = path.join(ASSETS, bg.filename);
  if (!fs.existsSync(srcWebp)) throw new Error(`Source not found: ${srcWebp}`);

  ensureDir(OUT);

  const tmpPng = path.join(OUT, `${assetName}-src.png`);
  // convert webp -> png
  await sharp(srcWebp).png().toFile(tmpPng);

  // run project's upscaler on the PNG
  const upBuf = await upscaleImage(tmpPng, { isOverlay: false });
  const upTmp = path.join(OUT, `${assetName}-up.png`);
  fs.writeFileSync(upTmp, upBuf);

  // resize to prompt-specified size
  const dims = parseSize(bg.size || "1024x1536");
  const resizedTmp = path.join(OUT, `${assetName}-up-resized.png`);
  if (dims) {
    await sharp(upTmp).resize(dims.w, dims.h, { fit: 'cover' }).png().toFile(resizedTmp);
  } else {
    fs.copyFileSync(upTmp, resizedTmp);
  }

  const dest = path.join(OUT, bg.filename);
  await convertToWebp(resizedTmp, dest, 90);
  return dest;
}

async function main() {
  const targets = ["bg-stone-01", "bg-stone-02"];
  const results = [];
  for (const t of targets) {
    try {
      const r = await processWebp(t);
      console.log(`Wrote ${r}`);
      results.push(r);
    } catch (err) {
      console.error(`Failed ${t}:`, err && err.message ? err.message : err);
    }
  }
  console.log("Done. Upscaled outputs:");
  results.forEach((r) => console.log(` - ${r}`));
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
