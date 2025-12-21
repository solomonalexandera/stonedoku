"use strict";
const path = require("path");
const fs = require("fs");
const { upscaleImage } = require("./lib/upscale");
const { ensureDir, convertToWebp } = require("./lib/convert");

const ROOT = path.resolve(__dirname, "..");
const TMP = path.join(ROOT, "tmp_assets");
const OUT = path.join(ROOT, "assets");

const stones = ["bg-stone-01", "bg-stone-02"];

async function doOne(name) {
  const src = path.join(TMP, `${name}.png`);
  if (!fs.existsSync(src)) {
    console.warn(`source missing: ${src} — skipping`);
    return null;
  }
  console.log(`Upscaling ${name} from ${src}`);
  const buf = await upscaleImage(src, { isOverlay: false });
  const upPath = path.join(TMP, `${name}-up.png`);
  fs.writeFileSync(upPath, buf);
  ensureDir(OUT);
  const dest = path.join(OUT, `${name}.webp`);
  await convertToWebp(upPath, dest, 90);
  // keep tmp up file for inspection
  return { name, src, upPath, dest };
}

async function main() {
  const results = [];
  for (const s of stones) {
    try {
      const r = await doOne(s);
      if (r) results.push(r);
    } catch (err) {
      console.error(`Failed ${s}:`, err && err.message ? err.message : err);
    }
  }
  console.log("Done. Results:");
  for (const r of results) {
    try {
      const stat = fs.statSync(r.dest);
      console.log(`${r.name} -> ${r.dest} (${Math.round(stat.size/1024)} KB)`);
    } catch (_) {
      console.log(`${r.name} -> missing dest`);
    }
  }
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
