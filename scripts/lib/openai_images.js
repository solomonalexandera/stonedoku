"use strict";
const fetch = require("node-fetch");

/**
 * Generate an image using OpenAI Responses API with image_generation tool.
 * Relies on OPENAI_API_KEY (and optional OPENAI_IMAGE_MODEL).
 */
async function generateImage({ prompt, size = "1024x1024", aspectRatio = "1:1", isOverlay = false }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required");

  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const body = {
    model,
    prompt,
    size,
  };

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    // Provide a graceful fallback placeholder image when API access is unavailable
    console.warn(`OpenAI image generation failed: ${res.status} ${text}`);
    // 1x1 transparent PNG
    const placeholderB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
    return Buffer.from(placeholderB64, 'base64');
  }
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image returned");
  return Buffer.from(b64, "base64");
}

module.exports = { generateImage };
