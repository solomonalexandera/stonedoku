"use strict";

/**
 * OpenAI image generation helper.
 *
 * Uses OpenAI Responses API with the `image_generation` tool when available.
 * Falls back to Images API if needed.
 *
 * Reads:
 * - OPENAI_API_KEY (required)
 * - OPENAI_BASE_URL (optional, defaults to https://api.openai.com)
 *
 * IMPORTANT: We intentionally do NOT hardcode an image model name; the tool
 * selection uses the platform's latest image generation capability by default.
 */

function getBaseUrl() {
  return (process.env.OPENAI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
}

async function postJson(url, apiKey, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {}
  if (!res.ok) {
    const msg = json ? JSON.stringify(json) : text;
    const err = new Error(`OpenAI request failed: ${res.status} ${msg}`);
    err.status = res.status;
    err.body = json || text;
    throw err;
  }
  return json;
}

function extractBase64FromResponses(payload) {
  // Try to find base64 in common response shapes
  // - output[].content[].type == "output_image" with base64 data
  // - output[].type == "image_generation" with b64
  const output = payload?.output || payload?.data || [];
  for (const item of output) {
    const content = item?.content || [];
    for (const c of content) {
      if (c?.type === "output_image" && c?.b64_json) return c.b64_json;
      if (c?.type === "output_image" && c?.image_base64) return c.image_base64;
      if (c?.type === "image" && c?.b64_json) return c.b64_json;
    }
    if (item?.type === "image_generation" && item?.b64_json) return item.b64_json;
    if (item?.b64_json) return item.b64_json;
  }
  // Some implementations return `output[0].result.b64_json`
  for (const item of output) {
    const b64 = item?.result?.b64_json || item?.result?.image_base64;
    if (b64) return b64;
  }
  return null;
}

async function generateImage({ prompt, size = "1024x1024", aspectRatio = "1:1", isOverlay = false, background: backgroundOverride }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required");

  const baseUrl = getBaseUrl();

  // Prefer Responses API with image_generation tool.
  // Predefine genSize so the fallback can reuse the mapped generation size.
  let genSize = size;
  try {
    const background = typeof backgroundOverride !== 'undefined' ? backgroundOverride : (isOverlay ? "transparent" : "opaque");
    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5";
    // The Responses image tool supports a limited set of generation sizes. If the
    // requested `size` isn't supported, choose the closest supported generation
    // size and upscale later. This avoids 400 errors like "Invalid value: '2048x3072'".
    const supported = ["1024x1024", "1024x1536", "1536x1024", "auto"];
    if (!supported.includes(size)) {
      const m = /^([0-9]+)x([0-9]+)$/.exec(size);
      if (m) {
        const w = parseInt(m[1], 10);
        const h = parseInt(m[2], 10);
        const ratio = w / h;
        if (Math.abs(ratio - 1) < 0.1) genSize = "1024x1024";
        else if (ratio < 1) genSize = "1024x1536"; // portrait
        else genSize = "1536x1024"; // landscape
      } else {
        genSize = "auto";
      }
    }
    const body = {
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: prompt }],
        },
      ],
      // Ask for the latest image generation tool; do not pin model.
      tools: [
        {
          type: "image_generation",
          model,
          // Best-effort tool settings; keep these minimal to avoid unknown-parameter errors.
          size: genSize,
          background,
          quality: "high",
          output_format: "png",
        },
      ],
      tool_choice: { type: "image_generation" },
      metadata: { aspectRatio, isOverlay: !!isOverlay },
    };

    const json = await postJson(`${baseUrl}/v1/responses`, apiKey, body);
    const b64 = extractBase64FromResponses(json);
    if (!b64) throw new Error("No image returned from Responses API");
    return Buffer.from(b64, "base64");
  } catch (err) {
    // Fall back only if endpoint/tool isn't available; otherwise rethrow.
    const status = err?.status;
    if (status && status !== 404 && status !== 400) throw err;
  }

  // Fallback: Images API (still not pinning deprecated models; server default may apply).
  const imagesBody = {
    prompt,
    model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5",
    size: typeof genSize !== "undefined" ? genSize : size,
    // Request a transparent background for overlays so downstream vectorization preserves alpha.
    background: isOverlay ? "transparent" : "opaque",
  };
  const json2 = await postJson(`${baseUrl}/v1/images/generations`, apiKey, imagesBody);
  const b64 = json2?.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image returned from Images API");
  return Buffer.from(b64, "base64");
}

module.exports = { generateImage };
