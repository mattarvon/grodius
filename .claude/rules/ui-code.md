---
paths:
  - "src/menus.ts"
  - "src/input.ts"
  - "src/render/screens.ts"
  - "src/render/hud.ts"
  - "src/render/hype.ts"
---

# UI Code Rules

Menus, HUD and screens are drawn directly on the canvas (`txt()` in
`src/render/util.ts`); menus are item arrays (`{ l, r, a }`) in `src/menus.ts`.

- UI reads game state to display it; it changes state only through the existing
  actions (menu item `a()` callbacks, `newGame()`, `openShop()`), never by poking
  fields from draw code.
- Every interactive element works with **keyboard, gamepad and touch**
  (`src/input.ts` handles all three). Touch targets must be large enough for a
  thumb on a phone held landscape.
- Text must fit at the smallest supported canvas resolution (`autoQuality` can
  drop resolution) and stay legible over gore backgrounds; check with the
  screens rig (`tools/screens-shot.mjs`).
- Player-facing strings follow the copy rules in `design/` (tone guardrails in
  `design/game-brief.md`; one noun per progression system). The game is
  English-only for now (no localization layer); keep strings in one place per
  screen so a later pass can extract them.
- Animations and flashes respect `SET.flashes`; nothing flashes the full screen
  more than 3 times per second.
- Never block the frame: no synchronous storage or layout reads in draw code.
- A UI change is verified by a screenshot of each screen touched (advisory
  evidence in `production/qa/evidence/`).
