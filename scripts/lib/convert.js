"use strict";
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function atomicReplace(tmpPath, destPath) {
  ensureDir(path.dirname(destPath));
  try {
    fs.renameSync(tmpPath, destPath);
  } catch (err) {
    // Cross-device rename fallback
    fs.copyFileSync(tmpPath, destPath);
    fs.unlinkSync(tmpPath);
  }
}

function backupAssets(assetsDir) {
  if (!fs.existsSync(assetsDir)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(assetsDir, "_backup", stamp);
  ensureDir(backupDir);
  fs.readdirSync(assetsDir).forEach((f) => {
    const src = path.join(assetsDir, f);
    const dest = path.join(backupDir, f);
    if (fs.lstatSync(src).isFile()) {
      fs.copyFileSync(src, dest);
    }
  });
  return backupDir;
}

async function convertToWebp(inputPath, destPath, quality = 85) {
  const dir = path.dirname(destPath);
  ensureDir(dir);
  const tmpPath = path.join(dir, `.${path.basename(destPath)}.tmp`);
  await sharp(inputPath).webp({ quality, effort: 5 }).toFile(tmpPath);
  atomicReplace(tmpPath, destPath);
}

function summarizeFiles(files) {
  return files.map((f) => {
    const stat = fs.statSync(f);
    return { file: f, sizeKb: Math.round(stat.size / 1024), dimensions: null };
  });
}

module.exports = { ensureDir, backupAssets, convertToWebp, summarizeFiles, atomicReplace };
