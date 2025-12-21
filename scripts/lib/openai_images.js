"use strict";
const fetch = require("node-fetch");

// 1x1 transparent PNG (base64)
const PLACEHOLDER_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
const PLACEHOLDER_BUFFER = Buffer.from(PLACEHOLDER_PNG_B64, "base64");

/**
 * Generate an image using OpenAI Images API.
 * Returns a Buffer containing PNG bytes. On API errors or missing data,
 * returns a small 1x1 PNG placeholder so the pipeline can continue.
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

  // Retry transient failures a few times to handle propagation/rate-limit issues.
  const maxTries = 3;
  let res = null;
  for (let attempt = 1; attempt <= maxTries; attempt++) {
    try {
      res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.warn(`OpenAI request error (attempt ${attempt}):`, err.message || err);
      res = null;
    }

    if (res && res.ok) break;

    // If we have a response with a body, log it for debugging
    if (res && !res.ok) {
      const txt = await (async () => {
        try {
          return await res.text();
        } catch (_) {
          return `${res.status}`;
        }
      })();
      console.warn(`OpenAI image generation failed (attempt ${attempt}): ${res.status} ${txt}`);
    }

    // Don't hammer the API — wait a bit before retrying
    if (attempt < maxTries) await new Promise((r) => setTimeout(r, 1500 * attempt));
  }

  if (!res || !res.ok) {
    console.warn("OpenAI image generation ultimately failed; using placeholder");
    return PLACEHOLDER_BUFFER;
  }

  let json;
  try {
    json = await res.json();
  } catch (err) {
    console.warn("Failed to parse OpenAI response as JSON:", err.message || err);
    return PLACEHOLDER_BUFFER;
  }

  // Attempt to find base64 image data in common response shapes
  const b64 = json.data?.[0]?.b64_json || json.data?.[0]?.b64 || json.data?.[0]?.url || null;
  if (!b64) {
    console.warn("OpenAI returned no image data; using placeholder");
    return PLACEHOLDER_BUFFER;
  }

  // If it's a URL (unlikely with current usage), attempt to fetch it
  if (b64 && typeof b64 === "string" && b64.startsWith("http")) {
    try {
      const r = await fetch(b64);
      if (!r.ok) return PLACEHOLDER_BUFFER;
      const buf = await r.arrayBuffer();
      return Buffer.from(buf);
    } catch (err) {
      console.warn("Failed to fetch image URL from OpenAI response:", err.message || err);
      return PLACEHOLDER_BUFFER;
    }
  }

  // Otherwise assume base64 image data
  try {
    return Buffer.from(b64, "base64");
  } catch (err) {
    console.warn("Failed to decode base64 image from OpenAI response:", err.message || err);
    return PLACEHOLDER_BUFFER;
  }
}

module.exports = { generateImage };
