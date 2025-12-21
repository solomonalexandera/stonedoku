"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { atomicReplace } = require("./convert");
let potrace;
try {
  potrace = require("potrace");
} catch (_) {
  potrace = null;
}

function hasBinary(bin) {
  try {
    execFileSync(bin, ["-h"], { stdio: "ignore" });
    return true;
  } catch (_) {
    return false;
  }
}

async function vectorizeOverlay(pngPath, destSvg) {
  const dir = path.dirname(destSvg);
  fs.mkdirSync(dir, { recursive: true });
  const tmpSvg = path.join(dir, `.${path.basename(destSvg)}.tmp`);

  if (potrace) {
    return new Promise((resolve, reject) => {
      const trace = new potrace.Potrace();
      trace.setParameters({ color: "black", background: "transparent", turdSize: 0, optTolerance: 0.2, threshold: 180 });
      trace.loadImage(pngPath, (err) => {
        if (err) return reject(err);
        trace.getSVG((err2, svg) => {
          if (err2) return reject(err2);
          fs.writeFileSync(tmpSvg, svg);
          atomicReplace(tmpSvg, destSvg);
          resolve();
        });
      });
    });
  }

  if (hasBinary("potrace")) {
    const cliSvg = path.join(path.dirname(pngPath), `${path.basename(pngPath, ".png")}.svg`);
    execFileSync("potrace", ["-s", "-o", cliSvg, pngPath], { stdio: "inherit" });
    fs.copyFileSync(cliSvg, tmpSvg);
    fs.unlinkSync(cliSvg);
    atomicReplace(tmpSvg, destSvg);
    return;
  }

  // Fallback: embed PNG in simple SVG (still works as overlay, but not vector traced)
  const meta = await sharp(pngPath).metadata();
  const width = meta.width || 1024;
  const height = meta.height || 1024;
  const b64 = fs.readFileSync(pngPath).toString("base64");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><image href="data:image/png;base64,${b64}" x="0" y="0" width="${width}" height="${height}" /></svg>`;
  fs.writeFileSync(tmpSvg, svg);
  atomicReplace(tmpSvg, destSvg);
}

module.exports = { vectorizeOverlay };
