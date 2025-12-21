# Clash of Worlds Assets

These are placeholder assets for the cinematic stone environment. Replace with your final HD art when ready.

## Files
- `bg-stone-01.webp`, `bg-stone-02.webp`, `bg-parliament-shadow-01.webp`: placeholder 1024x1536 WebP images (muted stone gradients + faint arches). Replace with 2K–4K WebP (lossy q70–80) that are low-saturation stone/concrete with soft architectural shadows and no obvious tiling seams.
- `vault-ribs.svg`: subtle Parliament-like rib shadows.
- `tracery-corners.svg`: faint civic Gothic corner tracery.
- `cracks.svg`: hairline crack overlay for strain/collapse states.
- `dust.svg`: dust motes/specks overlay.

## Serve path
- Firebase hosting `public` root is `.`, and assets are served from `/assets/`.
- Keep generated art in the repo `assets/` directory so URLs like `/assets/bg-stone-01.webp` resolve correctly. The generator backs up old files into `assets/_backup/<timestamp>`.

## Swap instructions
1) Place your production art in this folder with the same filenames or update CSS variables in `assets.css`:
   - `--asset-bg-stone-hd-def` (stone wall base)
   - `--asset-soot-vignette-def` (vignette/soot)
   - `--asset-vault-ribs-def` (arches/ribs)
   - `--asset-tracery-corners-def` (tracery corners)
   - `--asset-cracks-def` (cracks)
   - `--asset-dust-motes-def` (dust)
2) Keep contrast gentle; avoid strong color casts. Aim for 8–12% variance across the frame to avoid banding.
3) Preferred format: WebP (lossy), 2K–4K resolution. Fallback acceptable: PNG.
4) If you change filenames, update the CSS URLs in `assets.css`.

## Notes
- CSS already falls back to gradient-based textures if these files are missing.
- Dust/crack overlays are blended via `mix-blend-mode`; keep backgrounds fairly neutral so overlays remain subtle.
