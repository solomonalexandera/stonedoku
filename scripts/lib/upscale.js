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

  // Add subtle monochrome grain to avoid plasticky finish
  const grainOut = path.join(dir, `${path.basename(inputPath, ext)}-grain.png`);
  const grain = sharp(out)
    .linear(1, 0)
    .png();
  const noise = Buffer.alloc(256 * 256 * 3, 127);
  await grain.composite([{ input: await sharp(noise, { raw: { width: 256, height: 256, channels: 3 } }).resize({ width: undefined, height: undefined, fit: "cover" }).png().toBuffer(), tile: true, blend: "overlay" }]).toFile(grainOut);

  const finalBuf = fs.readFileSync(grainOut);
  fs.unlinkSync(out);
  fs.unlinkSync(grainOut);
  return finalBuf;
}

module.exports = { upscaleImage };
