"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

function hasBinary(bin) {
  try {
    execFileSync(bin, ["-h"], { stdio: "ignore" });
    return true;
  } catch (_) {
    return false;
  }
}

async function upscaleImage(inputPath, { isOverlay = false }) {
  const ext = path.extname(inputPath);
  const dir = path.dirname(inputPath);
  const out = path.join(dir, `${path.basename(inputPath, ext)}-up.png`);
  const useRealEsr = hasBinary("realesrgan-ncnn-vulkan");
  const useUpscayl = !useRealEsr && hasBinary("upscayl-cli");

  // For overlays we must preserve alpha. External upscalers or grain steps
  // may strip alpha channels. Use a safe sharp-only upscale path for overlays.
  if (isOverlay) {
    const img = sharp(inputPath, { failOnError: false });
    const meta = await img.metadata();
    const targetW = Math.round((meta.width || 1024) * 3);
    const targetH = Math.round((meta.height || 1024) * 3);
    await img
      .resize(targetW, targetH, { kernel: sharp.kernel.lanczos3 })
      .png({ compressionLevel: 9 })
      .toFile(out);
  } else {
    if (useRealEsr) {
      execFileSync("realesrgan-ncnn-vulkan", ["-i", inputPath, "-o", out, "-s", "4", "-n", "realesrgan-x4plus"], { stdio: "inherit" });
    } else if (useUpscayl) {
      execFileSync("upscayl-cli", ["-i", inputPath, "-o", out, "-m", "realesrgan", "-s", "4"], { stdio: "inherit" });
    } else {
      // Fallback: high-quality lanczos resize with mild grain
      const img = sharp(inputPath);
      const meta = await img.metadata();
      const targetW = Math.round((meta.width || 1024) * 3);
      const targetH = Math.round((meta.height || 1024) * 3);
      await img
        .resize(targetW, targetH, { kernel: sharp.kernel.lanczos3 })
        .modulate({ brightness: 1.0, saturation: 0.98 })
        .sharpen()
        .toFile(out);
    }
  }

  // Add subtle monochrome grain to avoid plasticky finish (fallback path only).
  // Skip grain for overlays to preserve alpha integrity.
  const finalBuf = fs.readFileSync(out);
  try {
    // Clean up the intermediate file; caller expects a Buffer.
    fs.unlinkSync(out);
  } catch (_) {}
  return finalBuf;
}

module.exports = { upscaleImage };
