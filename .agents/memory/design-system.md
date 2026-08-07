---
name: PlusPuls unified design system
description: Binding visual rules from the user's uploaded design spec (Aug 2026)
---

Source of truth: `attached_assets/Pasted-Let-me-redesign-the-entire-visual-system-from-scratch-u_1786073708133.txt`.

Rules (user-approved, replace the earlier gradient-card look):
- One accent: teal `#2EE6A6` — only for active states, money values, primary CTA. Amber `#FFB547` = caution, coral `#FF5470` = surge/danger. Everything else grayscale on dark bg `#0A0D14`, surface `#121622`, border `#222838`.
- **No gradients, no glows, no blooms** anywhere. Flat solids only; max 3 shadow levels.
- Dark text `#0A0D14` on teal buttons; radius 16px cards, 12–14px buttons.
- Map exception: user explicitly demands **light** CartoDB tiles — dark map tokens from spec do NOT apply to tiles; dormant heat tier uses muted grey `#8B8FA8` @ 0.12 instead of the spec's dark `#1A3328` (invisible/muddy on light map).
- shadcn `--accent` must stay a neutral hover fill (surface.2) — never coral, or all hover/selected primitives look like errors.

**Why:** user uploaded a complete design-system spec and it supersedes prior visuals; code review failed the first pass for leftover glows/gradients.
**How to apply:** any new UI (Earnings/Planner/Subscription restyle, animations tasks #10/#11) must follow these tokens; check for stray purple/orange/emerald Tailwind classes.
