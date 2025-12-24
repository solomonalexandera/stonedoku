# Motion Spec — Stonedoku “Clash of Worlds”
Source brief: DESIGN_BRIEF.md

## Global Easing & Timing
- Default easing: `cubic-bezier(0.2, 0, 0, 1)` (weighty drift).
- Durations: 220–420ms for UI; 600–1200ms for collapse micro-events.
- Hover: 140–200ms warm-up (shadow deepen, slight tint).
- Reduced-motion: disable translate/scale; use opacity + color shifts only.

## Core Interactions
- Cell selection: 180–220ms etched highlight (inner shadow pulse).
- Number input (correct): 200ms scale-up 1.04 → 1.0, brief engraved glow.
- Number input (error): 160ms shake of text only; background to oxblood haze for 320ms then clear.
- Undo/Erase: 260ms fade/slide of value out; mist of carved dust (opacity only in reduced-motion).
- Notes toggle: note grid fades in/out (160–200ms), no movement.
- Buttons: press depression (translateY 1px) + shadow deepen; release to baseline.

## Board & Panels
- Board idle: subtle grain drift (opacity noise) on 12s loop <2% opacity.
- Panel entrance: slide-up 8–12px + fade (300ms), anchored to grid; no bounce.
- Modals: scale 0.98 → 1.0 + fade (280ms); backdrop darkens over 200ms.

## Collapse Moments (Easter Eggs)
- Triggers: perfect solve, rare sequences, idle, repeated mistakes.
- Effects (choose contextually, one at a time):
  - Micro-crack: hairline fractures animate across grid lines; 800ms then fade.
  - Sag: a 3×3 box dips by 3–5px then re-levels over 900ms.
  - Gravity flicker: numbers drop 4–6px with easing, then re-lock in 500ms.
  - Gothic emergence: shadow arches sweep in behind the board (overlay gradient) for 1.2s then vanish.
- Reduced-motion: replace with color/surface pulses (darken/lighten), no movement.

## Chat & Overlays
- Chat open/close: scale 0.96 → 1 and fade; snap closed to opacity 0. Rotate/translate disabled in reduced-motion.
- Tooltips: fade-up 6px over 160ms.

## Sound Hooks (optional)
- Correct: soft pencil-on-paper tick.
- Error: muted thud + low rumble at low volume.
- Collapse: distant stone groan (<0.4s).
