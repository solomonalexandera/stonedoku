"use strict";
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { ensureDir, convertToWebp } = require('./lib/convert');
const { upscaleImage } = require('./lib/upscale');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'public', 'assets');
const TMP = path.join(ROOT, 'tmp_assets');

const BACKUP_DIR = path.join(ASSETS, '_backup', new Date().toISOString().replace(/[:.]/g, '-'));
ensureDir(BACKUP_DIR);
ensureDir(TMP);

const targets = ['bg-stone-01', 'bg-stone-02'];
const TARGET_W = 3072;
const TARGET_H = 4096;

async function process(name) {
  const srcWebp = path.join(ASSETS, `${name}.webp`);
  if (!fs.existsSync(srcWebp)) throw new Error(`source missing: ${srcWebp}`);

  // backup original
  const backupPath = path.join(BACKUP_DIR, `${name}.webp`);
  fs.copyFileSync(srcWebp, backupPath);

  // convert to PNG for upscaler
  const srcPng = path.join(TMP, `${name}-src.png`);
  await sharp(srcWebp).png().toFile(srcPng);

  // upscale using project upscaler
  const upBuf = await upscaleImage(srcPng, { isOverlay: false });
  const upPng = path.join(TMP, `${name}-up.png`);
  fs.writeFileSync(upPng, upBuf);

  // resize to exact target
  const resizedPng = path.join(TMP, `${name}-up-resized.png`);
  await sharp(upPng).resize(TARGET_W, TARGET_H, { fit: 'cover' }).png().toFile(resizedPng);

  // convert back to webp and overwrite asset
  const destWebp = path.join(ASSETS, `${name}.webp`);
  await convertToWebp(resizedPng, destWebp, 90);

  // cleanup tmp files for this asset
  [srcPng, upPng, resizedPng].forEach((p) => { try { fs.unlinkSync(p); } catch (_) {} });
  return destWebp;
}

async function main() {
  const results = [];
  for (const t of targets) {
    try {
      console.log('Processing', t);
      const r = await process(t);
      results.push(r);
      console.log('Wrote', r);
    } catch (err) {
      console.error('Failed', t, err && err.message ? err.message : err);
    }
  }

  // remove upscaled folder if present
  const upscaledDir = path.join(ASSETS, 'upscaled');
  if (fs.existsSync(upscaledDir)) {
    try {
      fs.readdirSync(upscaledDir).forEach((f) => fs.unlinkSync(path.join(upscaledDir, f)));
      fs.rmdirSync(upscaledDir);
      console.log('Removed', upscaledDir);
    } catch (e) {
      console.warn('Could not fully remove upscaled dir:', e.message || e);
    }
  }

  console.log('Done. Backed up originals to', BACKUP_DIR);
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
