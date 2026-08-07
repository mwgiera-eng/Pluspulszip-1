---
name: PlusPuls design system
description: Current binding visual direction for PlusPuls (neon night-drive cockpit) and its history
---

# PlusPuls visual direction (current: NEON, since Aug 7 2026)

The user explicitly replaced the earlier flat no-glow system with a **neon "night-drive cockpit"** aesthetic, based on a concept board they uploaded (attached_assets/image_1786079178029.png).

Rules:
- Dark base stays #0A0D14 family; teal #2EE6A6 remains the primary accent — but now it GLOWS (halos, soft shadows, pulses are welcome and expected).
- Fonts: DM Sans + Space Mono.
- Luminous greens for the map heat grid (green gradient tiers, red #FF5470 surge core), amber #FFB547 caution, coral #FF5470 danger/jammed.
- Light map tiles remain a user-mandated exception (dark UI chrome over light map).
- Traffic dots are congestion-colored: teal flowing / amber busy / coral jammed.

**Why:** user rejected the flat look after seeing the neon concept gallery and chose "shift the whole app toward this neon/glow aesthetic" — this supersedes the old "no gradients/glows" rule from the earlier spec.

**How to apply:** any new screen/component should glow tastefully like the concept board; do not revert to flat borders-only styling. The "NEXT MOVE" card (NextMoveCard.tsx) is the reference component for the current direction.

History: the previous flat system (one accent, no gradients/glows) came from a pasted spec in attached_assets and was binding until Aug 7 2026.
