"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
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

  if (potrace) {
    return new Promise((resolve, reject) => {
      const trace = new potrace.Potrace();
      trace.setParameters({ color: "black", background: "transparent", turdSize: 0, optTolerance: 0.2, threshold: 180 });
      trace.loadImage(pngPath, (err) => {
        if (err) return reject(err);
        trace.getSVG((err2, svg) => {
          if (err2) return reject(err2);
          fs.writeFileSync(destSvg, svg);
          resolve();
        });
      });
    });
  }

  if (hasBinary("potrace")) {
    const tmpSvg = path.join(path.dirname(pngPath), `${path.basename(pngPath, ".png")}.svg`);
    execFileSync("potrace", ["-s", "-o", tmpSvg, pngPath], { stdio: "inherit" });
    fs.copyFileSync(tmpSvg, destSvg);
    fs.unlinkSync(tmpSvg);
    return;
  }

  // Fallback: embed PNG in simple SVG (still works as overlay, but not vector traced)
  const b64 = fs.readFileSync(pngPath).toString("base64");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><image href="data:image/png;base64,${b64}" x="0" y="0" width="1024" height="1024" /></svg>`;
  fs.writeFileSync(destSvg, svg);
}

module.exports = { vectorizeOverlay };
